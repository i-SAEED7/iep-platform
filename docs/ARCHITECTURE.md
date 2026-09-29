# Architecture

## Core Rules
- One personal User identity platform-wide.
- Role, Permission, and Scope are separate.
- Every protected operation must enforce:
  1. Identity
  2. Permission
  3. Scope
- Never rely on frontend hiding as authorization.
- Public URLs/API should use random public identifiers, not sequential internal IDs.
- Published educational records use status/version history instead of hard delete.

## IEP Boundary
One IEP per:
- Student
- Subject
- Semester

Student master information is shared and updates across all subject plans.

## IEP Structure
1. معلومات الطالب
2. نقاط القوة والضعف
3. توزيع الأهداف
4. توزيع المنهج
5. النموذج التدريسي

## Assessment Pipeline
Teacher curriculum → Lessons → Candidate skills → Teacher approval → Assessment blueprint → Student session → Evidence → Agent suggestion → Teacher approval → Strength/Weakness → IEP.

Current scoring model:
- 2 = correct independently
- 1 = correct after one simplified rephrase
- 0 = incorrect / no response

Current assessment model uses 5 attempts per skill.

## AI Agent Modes
### Assessment Mode
- Evaluator only.
- No explaining.
- No solving.
- No hinting.
- One simplified rephrase maximum.
- Do not show correct/incorrect or score to student.

### Learning Mode
- Uses minimum required context: lesson + current goal + selected weakness + learner level.
- May generate/adapt activities.
- May not alter IEP, mastery decisions, permissions, or accounts.

## Guardian Link
Guardian self-registration uses Student Code.
The supervising teacher is the operational link with the guardian and normally approves the relationship.
Manager fallback is only used when there is no active supervising teacher.

## Teacher Scope
Teacher sees assigned students only, including names, plans, files, assessments, and activities.

## Delivery
Build in phases. Every phase must include database changes, backend rules, frontend, tests, seed data, and documentation.
