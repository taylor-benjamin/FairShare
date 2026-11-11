"use client";

import { useActionState, useState } from "react";
import { createProjectAction } from "@/app/actions/instructor";
import { SubmitButton } from "@/components/forms";
import { Field, LinkButton } from "@/components/ui";

interface Props {
  templates: { template_id: number; template_name: string; template_description: string }[];
  courses: { course_id: number; course_code: string; course_name: string; section_number: string }[];
  defaults: { startDate: string; endDate: string };
}

export function NewProjectForm({ templates, courses, defaults }: Props) {
  const [state, action] = useActionState(createProjectAction, {});
  const v = state.values ?? {};
  const [courseId, setCourseId] = useState(v.courseId || (courses[0] ? String(courses[0].course_id) : "new"));

  return (
    <form action={action} className="space-y-6" noValidate>
      <fieldset className="space-y-2">
        <legend className="font-semibold">What kind of project are you running?</legend>
        {templates.map((t, i) => (
          <label key={t.template_id} className="flex cursor-pointer items-start gap-3 rounded-(--radius-card) border border-line bg-surface p-4 transition has-checked:border-primary has-checked:bg-primary-soft">
            <input type="radio" name="templateId" value={t.template_id} defaultChecked={v.templateId ? v.templateId === String(t.template_id) : i === 0} className="mt-1 accent-primary" />
            <span>
              <span className="font-semibold">{t.template_name}</span>
              <span className="block text-small text-hint">{t.template_description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">Which class is it for?</legend>
        {courses.length > 0 && (
          <Field label="Course" htmlFor="courseId">
            <select id="courseId" name="courseId" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="field-input">
              {courses.map((c) => (
                <option key={c.course_id} value={c.course_id}>
                  {c.course_code} {c.course_name} — Section {c.section_number}
                </option>
              ))}
              <option value="new">A different course or section…</option>
            </select>
          </Field>
        )}
        {(courseId === "new" || courses.length === 0) && (
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr]">
            <input type="hidden" name="courseId" value="new" />
            <Field label="Course code" htmlFor="courseCode" hint="e.g. MGT 3200">
              <input id="courseCode" name="courseCode" maxLength={20} defaultValue={v.courseCode} className="field-input" />
            </Field>
            <Field label="Course name" htmlFor="courseName" hint="e.g. Principles of Management">
              <input id="courseName" name="courseName" maxLength={100} defaultValue={v.courseName} className="field-input" />
            </Field>
            <Field label="Section" htmlFor="sectionNumber" hint="e.g. 2">
              <input id="sectionNumber" name="sectionNumber" maxLength={10} defaultValue={v.sectionNumber} className="field-input" />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">About the project</legend>
        <Field label="Project name" htmlFor="projectName" hint="Students see this in their channel header.">
          <input id="projectName" name="projectName" maxLength={100} defaultValue={v.projectName ?? "Semester Group Project"} className="field-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" htmlFor="startDate">
            <input id="startDate" name="startDate" type="date" defaultValue={v.startDate ?? defaults.startDate} className="field-input" />
          </Field>
          <Field label="Final due date" htmlFor="endDate">
            <input id="endDate" name="endDate" type="date" defaultValue={v.endDate ?? defaults.endDate} className="field-input" />
          </Field>
        </div>
      </fieldset>

      {state.error && (
        <p className="text-small text-disputed" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <LinkButton href="/instructor" variant="secondary">
          Cancel
        </LinkButton>
        <SubmitButton pendingText="Creating…">Next: upload class list</SubmitButton>
      </div>
    </form>
  );
}
