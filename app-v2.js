loadSettings=async function(){
  const res=await sb.from('app_settings').select('initiative_name').eq('id','main').single();
  if(res.error)return;
  if(document.getElementById('initiativeName')) initiativeName.value=res.data.initiative_name||'نحو خطة تربوية فردية رقمية تفاعلية';
  if(document.getElementById('initiativeName')) initiativeName.disabled=currentUser?.role!=='system_admin';
};

saveSettings=function(){
  if(currentUser?.role!=='system_admin')return;
  clearTimeout(settingsTimer);
  settingsTimer=setTimeout(async function(){
    const res=await sb.from('app_settings').update({initiative_name:initiativeName.value,updated_at:new Date().toISOString(),updated_by:currentUser.id}).eq('id','main');
    if(res.error)toast('تعذر حفظ الإعدادات');else toast('تم الحفظ');
  },450);
};

/* IEP Platform v2 interaction layer.
   Keeps the existing Supabase/Auth connection and replaces only the affected UI workflows. */

function organizationForProfile(profileId){
  const member=membershipsCache.find(function(m){return m.profile_id===profileId&&m.active&&m.is_primary})
    ||membershipsCache.find(function(m){return m.profile_id===profileId&&m.active});
  return member?organizationsCache.find(function(o){return o.id===member.organization_id}):null;
}

function configureOperationalPermissions(){
  const tabs={
    classes:can('manage_classes'),
    students:can('assign_students'),
    teachers:can('assign_teachers')
  };
  document.querySelectorAll('[data-class-tab]').forEach(function(btn){
    btn.classList.toggle('hidden',!tabs[btn.dataset.classTab]);
  });
  const visible=document.querySelector('[data-class-tab]:not(.hidden)');
  if(visible && !document.querySelector('[data-class-tab].active:not(.hidden)')) visible.click();

  const createCard=document.querySelector('#classTabClasses .card');
  if(createCard) createCard.classList.toggle('hidden',!can('manage_classes'));
  document.getElementById('orgSubjectSaveBtn')?.classList.toggle('hidden',!can('manage_org_subjects'));
  document.getElementById('orgSubjectInput')?.toggleAttribute('disabled',!can('manage_org_subjects'));
}

const baseGoTo=goTo;
goTo=async function(id){
  await baseGoTo(id);
  if(['orgSubjects','classManagement','settings','assessment','plans'].includes(id)){
    await loadCoreData();
  }
  if(id==='classManagement') configureOperationalPermissions();
  if(id==='assessment') syncAssessmentOptions();
  if(id==='plans') renderIeps();
};

openAccountModal=function(id){
  if(!can('manage_accounts')){toast('ليس لديك صلاحية إدارة الحسابات');return}
  id=id||'';
  const u=usersCache.find(function(x){return x.id===id});
  if(u&&u.role==='system_admin'){toast('حساب مدير النظام محمي من هذه الشاشة');return}
  editAccountId.value=id;
  accountModalTitle.textContent=id?'تعديل الحساب':'إنشاء حساب';
  setSelectOptions(accOrganization,organizationsCache.map(function(o){return {value:o.id,label:o.name}}),'اختر الجهة');

  if(u){
    accName.value=u.full_name;
    accEmail.value=u.email;
    accRole.value=u.role;
    accStatus.value=u.status;
    accPassword.value='';
    const member=membershipsCache.find(function(m){return m.profile_id===u.id&&m.active&&m.is_primary})
      ||membershipsCache.find(function(m){return m.profile_id===u.id&&m.active});
    if(member)accOrganization.value=member.organization_id;
    loadRolePermissions(u.permissions||[]);
  }else{
    accName.value='';
    accEmail.value='';
    accRole.value='teacher';
    accStatus.value='active';
    accPassword.value='';
    if(currentOrganization) accOrganization.value=currentOrganization.id;
    loadRolePermissions();
  }
  accountModal.classList.add('open');
};

saveAccount=async function(){
  if(!can('manage_accounts'))return;
  const id=editAccountId.value;
  const name=accName.value.trim();
  const email=accEmail.value.trim().toLowerCase();
  const role=accRole.value;
  const status=accStatus.value;
  const password=accPassword.value;
  const organizationId=accOrganization.value;
  if(!name||!email){toast('أدخل الاسم والبريد');return}
  if(!organizationId){toast('اختر الجهة المرتبط بها الحساب');return}
  if(!id&&password.length<12){toast('كلمة المرور يجب ألا تقل عن 12 حرفًا');return}
  if(id&&password&&password.length<12){toast('كلمة المرور الجديدة يجب ألا تقل عن 12 حرفًا');return}
  const permissions=Array.from(permissionEditor.querySelectorAll('input[data-perm]:checked')).map(function(x){return x.dataset.perm});
  const fn=id?'admin-update-user':'admin-create-user';
  const body={name:name,email:email,role:role,status:status,permissions:permissions,password:password};
  if(id)body.id=id;

  showBlocking(id?'جاري تحديث الحساب':'جاري إنشاء الحساب','يتم حفظ الحساب والصلاحيات وربطه بالجهة...');
  try{
    const res=await sb.functions.invoke(fn,{body:body});
    if(res.error||(res.data&&res.data.error)){toast(await getFunctionError(res,'تعذر حفظ الحساب'));return}
    const profileId=id||(res.data&&res.data.id);
    if(profileId){
      const orgRes=await sb.rpc('set_profile_primary_organization',{p_profile_id:profileId,p_organization_id:organizationId});
      if(orgRes.error){toast('تم حفظ الحساب ولكن تعذر ربطه بالجهة');return}
    }
    closeAccountModal();
    await loadCoreData();
    await loadAccounts();
    toast(id?'تم تحديث الحساب بنجاح':'تم إنشاء الحساب وربطه بالجهة');
  }finally{hideBlocking()}
};

renderAccounts=function(){
  let users=usersCache.slice();
  if(accountFilter==='active')users=users.filter(function(x){return x.status==='active'});
  if(accountFilter==='inactive')users=users.filter(function(x){return x.status==='inactive'});
  if(!users.length){
    accountList.innerHTML='<div class="empty"><strong>لا توجد حسابات</strong></div>';return;
  }
  accountList.innerHTML='<div class="table-card"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الجهة</th><th>الحالة</th><th>الصلاحيات</th><th>الإجراءات</th></tr></thead><tbody>'+
    users.map(function(u){
      const role=roleLabels[u.role]||u.role;
      const org=organizationForProfile(u.id);
      const status='<span class="tag '+(u.status==='active'?'ok':'off')+'">'+(u.status==='active'?'نشط':'معطل')+'</span>';
      let actions='—';
      if(u.role!=='system_admin'){
        actions='<div class="inline"><button class="btn outline sm" onclick="openAccountModal(\''+u.id+'\')">تعديل</button><button class="btn '+(u.status==='active'?'danger':'teal')+' sm" onclick="toggleAccount(\''+u.id+'\')">'+(u.status==='active'?'تعطيل':'تفعيل')+'</button></div>';
      }
      return '<tr><td><strong>'+esc(u.full_name)+'</strong></td><td>'+esc(u.email)+'</td><td>'+esc(role)+'</td><td>'+esc(org?org.name:'غير مرتبط')+'</td><td>'+status+'</td><td>'+((u.permissions||[]).length)+' صلاحيات</td><td>'+actions+'</td></tr>';
    }).join('')+'</tbody></table></div>';
};

function teacherClassIds(){
  return classSubjectAssignmentsCache.filter(function(a){return a.teacher_id===currentUser?.id&&a.active}).map(function(a){return a.class_id});
}
function teacherSubjectIdsForClass(classId){
  return classSubjectAssignmentsCache.filter(function(a){return a.teacher_id===currentUser?.id&&a.class_id===classId&&a.active}).map(function(a){return a.subject_id});
}
function studentEnrollment(studentId){
  return enrollmentsCache.find(function(e){return e.student_id===studentId&&e.active});
}
function studentIsAvailableToTeacher(studentId){
  if(currentUser?.role!=='teacher')return true;
  const enrollment=studentEnrollment(studentId);
  return !!(enrollment&&teacherClassIds().includes(enrollment.class_id));
}
function allowedSubjectsForStudentV2(studentId){
  if(currentUser?.role==='teacher'){
    const enrollment=studentEnrollment(studentId);
    if(!enrollment)return [];
    const ids=teacherSubjectIdsForClass(enrollment.class_id);
    return subjectsCache.filter(function(s){return ids.includes(s.id)&&s.lifecycle_status==='active'});
  }
  return subjectsCache.filter(function(s){
    return s.lifecycle_status==='active'&&(!currentOrganization||s.organization_id===currentOrganization.id);
  });
}

syncAssessmentOptions=function(){
  const studentEl=document.getElementById('assessmentStudent');
  const subjectEl=document.getElementById('assessmentSubject');
  if(!studentEl||!subjectEl)return;
  const oldStudent=studentEl.value,oldSubject=subjectEl.value;
  const students=studentsCache.filter(function(s){return studentIsAvailableToTeacher(s.id)});
  setSelectOptions(studentEl,students.map(function(s){return {value:s.id,label:fullStudentName(s)+' — '+s.student_code}}),'اختر الطالب');
  if(oldStudent&&students.some(function(s){return s.id===oldStudent}))studentEl.value=oldStudent;
  const sid=studentEl.value;
  const subjects=sid?allowedSubjectsForStudentV2(sid):[];
  setSelectOptions(subjectEl,subjects.map(function(s){return {value:s.id,label:s.name}}),'اختر المادة');
  if(oldSubject&&subjects.some(function(s){return s.id===oldSubject}))subjectEl.value=oldSubject;
};

syncIepOptions=function(){
  const studentEl=document.getElementById('iepStudent');
  const subjectEl=document.getElementById('iepSubject');
  if(!studentEl||!subjectEl)return;
  const oldStudent=studentEl.value,oldSubject=subjectEl.value;
  const students=studentsCache.filter(function(s){return studentIsAvailableToTeacher(s.id)});
  setSelectOptions(studentEl,students.map(function(s){return {value:s.id,label:fullStudentName(s)+' — '+s.student_code}}),'اختر الطالب');
  if(oldStudent&&students.some(function(s){return s.id===oldStudent}))studentEl.value=oldStudent;
  const sid=studentEl.value;
  const subjects=sid?allowedSubjectsForStudentV2(sid):[];
  setSelectOptions(subjectEl,subjects.map(function(s){return {value:s.id,label:s.name}}),'اختر المادة');
  if(oldSubject&&subjects.some(function(s){return s.id===oldSubject}))subjectEl.value=oldSubject;
};

window.syncIepSubjectOptions=function(){
  const old=iepSubject.value;
  const subjects=iepStudent.value?allowedSubjectsForStudentV2(iepStudent.value):[];
  setSelectOptions(iepSubject,subjects.map(function(s){return {value:s.id,label:s.name}}),'اختر المادة');
  if(subjects.some(function(s){return s.id===old}))iepSubject.value=old;
};

openSkillModal=function(){
  syncAssessmentOptions();
  const sid=assessmentStudent.value,sub=assessmentSubject.value;
  if(!sid||!sub){toast('اختر الطالب والمادة من شاشة تحديد المستوى أولًا');return}
  const studentOptions=studentsCache.filter(function(s){return s.id===sid}).map(function(s){return {value:s.id,label:fullStudentName(s)}});  
  const subjectOptions=allowedSubjectsForStudentV2(sid).filter(function(s){return s.id===sub}).map(function(s){return {value:s.id,label:s.name}});
  setSelectOptions(skillStudent,studentOptions,'الطالب');
  setSelectOptions(skillSubject,subjectOptions,'المادة');
  skillStudent.value=sid;skillSubject.value=sub;
  skillStudent.disabled=true;skillSubject.disabled=true;
  skillLesson.value='';skillCode.value='';skillText.value='';skillPrerequisite.value='';
  skillModal.classList.add('open');
};

function managerViewForIep(iepId){
  return iepViewsCache.find(function(v){return v.iep_id===iepId&&v.viewer_role==='school_manager'});
}
renderIeps=function(){
  const host=document.getElementById('iepsList');if(!host)return;
  const newBtn=document.getElementById('newIepBtn');
  if(newBtn)newBtn.classList.toggle('hidden',['school_manager','supervisor','guardian','student'].includes(currentUser?.role));
  const q=(document.getElementById('iepSearch')?.value||'').trim().toLowerCase();
  const rows=iepsCache.filter(function(i){
    const t=(studentName(i.student_id)+' '+getSubjectName(i.subject_id)+' '+i.academic_year+' '+i.semester).toLowerCase();
    return !q||t.includes(q);
  });
  if(!rows.length){host.innerHTML='<div class="empty"><div class="big">📘</div><strong>لا توجد خطط</strong><p>لا توجد خطط متاحة ضمن نطاق حسابك.</p></div>';return}
  host.innerHTML=rows.map(function(i){
    const view=managerViewForIep(i.id);
    let secondary='';
    if(currentUser?.role==='school_manager'){
      secondary=view?'<span class="tag ok">تم الاطلاع</span>':'<button class="btn teal sm" onclick="markIepViewed(\''+i.id+'\')">تم الاطلاع على خطة الطالب</button>';
    }else if(view){
      secondary='<div class="note" style="margin-top:10px">اطلع مدير المدرسة — '+esc(profileName(view.viewer_id))+'</div>';
    }
    return '<div class="plan-card"><div class="card-head"><div><h3>'+esc(studentName(i.student_id))+'</h3><div class="meta"><span>'+esc(getSubjectName(i.subject_id))+'</span><span>'+esc(i.academic_year)+'</span><span>'+esc(i.semester)+'</span></div></div></div><p class="muted small" style="margin-top:10px">'+esc(i.long_term_goal||'لم يكتب الهدف طويل المدى بعد')+'</p>'+secondary+'<div class="actions"><button class="btn outline sm" onclick="openIepModal(\''+i.id+'\')">فتح الخطة</button></div></div>';
  }).join('');
};

window.markIepViewed=async function(id){
  if(currentUser?.role!=='school_manager'){toast('هذه الوظيفة لمدير المدرسة');return}
  showBlocking('جاري تسجيل الاطلاع','يتم إثبات اطلاع المدير على الخطة...');
  try{
    const res=await sb.from('iep_views').upsert({iep_id:id,viewer_id:currentUser.id,viewer_role:'school_manager'},{onConflict:'iep_id,viewer_id'});
    if(res.error){toast(res.error.message);return}
    await loadCoreData();
    toast('تم تسجيل الاطلاع على الخطة');
  }finally{hideBlocking()}
};

async function loadIepObservationItems(iepIdValue){
  if(!iepIdValue){iepObservationItems=[];renderObservationItems();return}
  const res=await sb.from('iep_observation_items').select('*').eq('iep_id',iepIdValue).order('sort_order');
  if(res.error){toast(res.error.message);return}
  iepObservationItems=res.data||[];
  renderObservationItems();
}
function renderObservationItems(){
  function html(kind){
    const editable=!['school_manager','supervisor','guardian','student'].includes(currentUser?.role);
    const rows=iepObservationItems.filter(function(x){return x.kind===kind});
    if(!rows.length)return '<div class="muted small">لا توجد بنود بعد.</div>';
    return rows.map(function(x){
      const cls=kind==='strength'?'strength-item':'weakness-item';
      const excluded=x.status==='excluded';
      let actions='';
      if(editable){
        actions='<div class="actions"><button class="btn outline sm" onclick="editObservationItem(\''+x.id+'\')">تعديل</button><button class="btn light sm" onclick="excludeObservationItem(\''+x.id+'\')">'+(excluded?'إعادة':'استبعاد')+'</button><button class="btn danger sm" onclick="deleteObservationItem(\''+x.id+'\')">حذف</button></div>';
      }
      return '<div class="row '+cls+'" style="'+(excluded?'opacity:.58':'')+'"><div class="grow"><strong>'+esc(x.item_text)+'</strong><small>'+(excluded?'مستبعد':'مفعل')+'</small></div>'+actions+'</div>';
    }).join('');
  }
  if(document.getElementById('strengthItemsList'))strengthItemsList.innerHTML=html('strength');
  if(document.getElementById('weaknessItemsList'))weaknessItemsList.innerHTML=html('weakness');
}
window.addObservationItem=async function(kind){
  const input=kind==='strength'?strengthItemInput:weaknessItemInput;
  const text=input.value.trim();if(!text){toast('اكتب البند أولًا');return}
  const iep=iepId.value;
  if(!iep){
    iepObservationItems.push({id:'temp_'+Date.now()+'_'+Math.random(),kind:kind,item_text:text,status:'active',sort_order:iepObservationItems.filter(function(x){return x.kind===kind}).length+1,temp:true});
    input.value='';renderObservationItems();return;
  }
  const res=await sb.from('iep_observation_items').insert({iep_id:iep,kind:kind,item_text:text,status:'active',sort_order:iepObservationItems.filter(function(x){return x.kind===kind}).length+1,created_by:currentUser.id}).select().single();
  if(res.error){toast(res.error.message);return}
  input.value='';iepObservationItems.push(res.data);renderObservationItems();toast('تمت إضافة البند');
};
window.editObservationItem=async function(id){
  const item=iepObservationItems.find(function(x){return x.id===id});if(!item)return;
  const value=prompt('تعديل البند',item.item_text);if(value===null||!value.trim())return;
  if(item.temp){item.item_text=value.trim();renderObservationItems();return}
  const res=await sb.from('iep_observation_items').update({item_text:value.trim(),updated_at:new Date().toISOString()}).eq('id',id);
  if(res.error){toast(res.error.message);return}
  item.item_text=value.trim();renderObservationItems();toast('تم تعديل البند');
};
window.excludeObservationItem=async function(id){
  const item=iepObservationItems.find(function(x){return x.id===id});if(!item)return;
  const next=item.status==='excluded'?'active':'excluded';
  if(item.temp){item.status=next;renderObservationItems();return}
  const res=await sb.from('iep_observation_items').update({status:next,updated_at:new Date().toISOString()}).eq('id',id);
  if(res.error){toast(res.error.message);return}
  item.status=next;renderObservationItems();toast(next==='excluded'?'تم استبعاد البند':'تمت إعادة البند');
};
window.deleteObservationItem=async function(id){
  const item=iepObservationItems.find(function(x){return x.id===id});if(!item)return;
  if(!confirm('حذف هذا البند؟'))return;
  if(item.temp){iepObservationItems=iepObservationItems.filter(function(x){return x.id!==id});renderObservationItems();return}
  const res=await sb.from('iep_observation_items').delete().eq('id',id);
  if(res.error){toast(res.error.message);return}
  iepObservationItems=iepObservationItems.filter(function(x){return x.id!==id});renderObservationItems();toast('تم حذف البند');
};

openIepModal=async function(id){
  const i=iepsCache.find(function(x){return x.id===id});
  const readonlyRole=['school_manager','supervisor','guardian','student'].includes(currentUser?.role);
  iepId.value=i?i.id:'';
  iepModalTitle.textContent=i?'الخطة التربوية الفردية':'خطة جديدة';

  syncIepOptions();
  if(i){
    // ensure the existing values stay visible even for read-only users
    const student=studentsCache.find(function(s){return s.id===i.student_id});
    if(student&&!Array.from(iepStudent.options).some(function(o){return o.value===i.student_id})){
      iepStudent.add(new Option(fullStudentName(student)+' — '+student.student_code,i.student_id));
    }
    iepStudent.value=i.student_id;
    syncIepSubjectOptions();
    if(!Array.from(iepSubject.options).some(function(o){return o.value===i.subject_id})){
      iepSubject.add(new Option(getSubjectName(i.subject_id),i.subject_id));
    }
    iepSubject.value=i.subject_id;
  }
  iepYear.value=i?i.academic_year:'';
  iepSemester.value=i?i.semester:'الأول';
  iepLongGoal.value=i?i.long_term_goal:'';
  strengthItemInput.value='';weaknessItemInput.value='';

  [iepStudent,iepSubject,iepYear,iepSemester,iepLongGoal,strengthItemInput,weaknessItemInput].forEach(function(el){el.disabled=readonlyRole});
  document.querySelectorAll('#iepModal .subsection .inline .btn').forEach(function(btn){btn.classList.toggle('hidden',readonlyRole)});
  saveIepBtn.classList.toggle('hidden',readonlyRole);
  document.getElementById('addIepGoalBtn')?.classList.toggle('hidden',readonlyRole);

  iepGoalsArea.classList.toggle('hidden',!i);
  iepViewArea.classList.toggle('hidden',!i);
  iepObservationItems=[];
  if(i){
    await Promise.all([loadIepObservationItems(i.id),loadIepGoals(i.id)]);
    const view=managerViewForIep(i.id);
    if(currentUser?.role==='school_manager'){
      iepViewStatus.innerHTML=view?'<span class="tag ok">تم الاطلاع</span>':'<button class="btn teal" onclick="markIepViewed(\''+i.id+'\')">تم الاطلاع على خطة الطالب</button>';
    }else if(view){
      iepViewStatus.innerHTML='<div class="note">اطلع مدير المدرسة — '+esc(profileName(view.viewer_id))+'</div>';
    }else{
      iepViewStatus.innerHTML='<span class="muted small">لم يسجل اطلاع مدير المدرسة حتى الآن.</span>';
    }
  }else{
    iepViewStatus.innerHTML='';
    renderObservationItems();
    iepGoalsList.innerHTML='';
  }
  iepModal.classList.add('open');
};

saveIep=async function(){
  if(['school_manager','supervisor','guardian','student'].includes(currentUser?.role)){toast('هذا الحساب للاطلاع فقط على الخطة');return}
  const id=iepId.value;
  const sid=iepStudent.value,sub=iepSubject.value,year=iepYear.value.trim();
  if(!sid||!sub||!year){toast('اختر الطالب والمادة واكتب العام الدراسي');return}
  const allowed=allowedSubjectsForStudentV2(sid);
  if(currentUser?.role==='teacher'&&!allowed.some(function(s){return s.id===sub})){toast('المادة غير مسندة لك مع فصل هذا الطالب');return}

  const payload={student_id:sid,subject_id:sub,academic_year:year,semester:iepSemester.value,long_term_goal:iepLongGoal.value.trim(),status:'active',updated_at:new Date().toISOString()};
  showBlocking(id?'جاري تحديث الخطة':'جاري إنشاء الخطة','يتم حفظ بيانات الخطة والبنود...');
  try{
    let res;
    if(id){
      res=await sb.from('ieps').update(payload).eq('id',id).select().single();
    }else{
      payload.created_by=currentUser.id;
      res=await sb.from('ieps').insert(payload).select().single();
    }
    if(res.error){toast(res.error.message);return}
    const savedId=res.data.id;
    const pending=iepObservationItems.filter(function(x){return x.temp});
    if(pending.length){
      const rows=pending.map(function(x){return {iep_id:savedId,kind:x.kind,item_text:x.item_text,status:x.status,sort_order:x.sort_order,created_by:currentUser.id}});
      const itemRes=await sb.from('iep_observation_items').insert(rows);
      if(itemRes.error){toast(itemRes.error.message);return}
    }
    iepId.value=savedId;
    await loadCoreData();
    await loadIepObservationItems(savedId);
    iepGoalsArea.classList.remove('hidden');
    iepViewArea.classList.remove('hidden');
    await loadIepGoals(savedId);
    toast(id?'تم تحديث الخطة':'تم إنشاء الخطة');
  }finally{hideBlocking()}
};

renderReportSummary=async function(){
  const id=document.getElementById('reportIep')?.value||'';
  const host=document.getElementById('reportSummary');if(!host)return;
  if(!id){host.innerHTML='<p class="muted small">اختر خطة ثم اطبعها.</p>';return}
  const i=iepsCache.find(function(x){return x.id===id});if(!i)return;
  const [goalsRes,itemsRes]=await Promise.all([
    sb.from('short_term_goals').select('*').eq('iep_id',id).order('sort_order'),
    sb.from('iep_observation_items').select('*').eq('iep_id',id).eq('status','active').order('sort_order')
  ]);
  const goals=goalsRes.data||[],items=itemsRes.data||[];
  const strengths=items.filter(function(x){return x.kind==='strength'});
  const weaknesses=items.filter(function(x){return x.kind==='weakness'});
  host.innerHTML='<h3>'+esc(studentName(i.student_id))+'</h3><div class="meta"><span>'+esc(getSubjectName(i.subject_id))+'</span><span>'+esc(i.academic_year)+'</span><span>'+esc(i.semester)+'</span></div><div class="subsection"><strong>نقاط القوة</strong><ul>'+strengths.map(function(x){return '<li>'+esc(x.item_text)+'</li>'}).join('')+'</ul><strong>نقاط الضعف</strong><ul>'+weaknesses.map(function(x){return '<li>'+esc(x.item_text)+'</li>'}).join('')+'</ul><strong>الهدف طويل المدى</strong><p>'+esc(i.long_term_goal||'—')+'</p><strong>الأهداف قصيرة المدى</strong><ol>'+goals.map(function(g){return '<li>'+esc(g.goal_text)+'</li>'}).join('')+'</ol></div>';
};

printSelectedIep=async function(){
  const id=document.getElementById('reportIep')?.value||'';if(!id){toast('اختر خطة أولًا');return}
  const i=iepsCache.find(function(x){return x.id===id});if(!i)return;
  const results=await Promise.all([
    sb.from('short_term_goals').select('*').eq('iep_id',id).order('sort_order'),
    sb.from('curriculum_schedule').select('*').eq('iep_id',id),
    sb.from('iep_observation_items').select('*').eq('iep_id',id).eq('status','active').order('sort_order')
  ]);
  const goals=results[0].data||[],schedules=results[1].data||[],items=results[2].data||[];
  const strengths=items.filter(function(x){return x.kind==='strength'});
  const weaknesses=items.filter(function(x){return x.kind==='weakness'});
  const org=currentOrganization?.name||'';
  printSheet.innerHTML='<div style="font-family:Tahoma,Arial,sans-serif;direction:rtl"><div style="text-align:center;border-bottom:2px solid #382972;padding-bottom:10px;margin-bottom:18px"><div style="font-size:13px">مبادرة</div><h1 style="font-size:22px;margin:4px 0">نحو خطة تربوية فردية رقمية تفاعلية</h1><div>'+esc(org)+'</div></div><table style="width:100%;border-collapse:collapse;margin-bottom:14px"><tr><td><b>الطالب:</b> '+esc(studentName(i.student_id))+'</td><td><b>المادة:</b> '+esc(getSubjectName(i.subject_id))+'</td></tr><tr><td><b>العام:</b> '+esc(i.academic_year)+'</td><td><b>الفصل:</b> '+esc(i.semester)+'</td></tr></table><h3>نقاط القوة</h3><ul>'+strengths.map(function(x){return '<li>'+esc(x.item_text)+'</li>'}).join('')+'</ul><h3>نقاط الضعف</h3><ul>'+weaknesses.map(function(x){return '<li>'+esc(x.item_text)+'</li>'}).join('')+'</ul><h3>الهدف طويل المدى</h3><p>'+esc(i.long_term_goal||'—')+'</p><h3>الأهداف قصيرة المدى</h3><table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><thead><tr><th>م</th><th>الهدف</th><th>التوزيع</th></tr></thead><tbody>'+goals.map(function(g,idx){const sc=schedules.find(function(x){return x.goal_id===g.id});return '<tr><td>'+(idx+1)+'</td><td>'+esc(g.goal_text)+'</td><td>'+esc(sc?sc.week_label:'—')+'</td></tr>'}).join('')+'</tbody></table></div>';
  window.print();
};

window.addEventListener('load',function(){
  setTimeout(function(){
    configureOperationalPermissions();
    syncAssessmentOptions();
    renderIeps();
  },0);
});
