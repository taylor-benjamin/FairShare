"use client";

import { useActionState, useEffect, useState } from "react";
import { createProjectAction } from "@/app/actions/instructor";
import { SubmitButton } from "@/components/forms";
import { DatePicker } from "@/components/date-picker";
import { Field, LinkButton } from "@/components/ui";

interface Props {
  templates: { template_id: number; template_name: string; template_description: string }[];
  courses: { course_id: number; course_code: string; course_name: string; section_number: string }[];
  /** Start with "A different course or section" chosen (from "New class" in the top bar). */
  newClass?: boolean;
}

/** A date on this device as YYYY-MM-DD, `addDays` from today. */
function localDate(addDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewProjectForm({ templates, courses, newClass = false }: Props) {
  const [state, action] = useActionState(createProjectAction, {});
  const v = state.values ?? {};
  const [courseId, setCourseId] = useState(v.courseId || (newClass || !courses[0] ? "new" : String(courses[0].course_id)));
  // Default dates come from the instructor's own device, so they're never "tomorrow" in the evening.
  const [startDate, setStartDate] = useState(v.startDate ?? "");
  const [endDate, setEndDate] = useState(v.endDate ?? "");
  useEffect(() => {
    setStartDate((d) => d || localDate());
    setEndDate((d) => d || localDate(98));
  }, []);

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
                  {c.course_code} {c.course_name} · Section {c.section_number}
                </option>
              ))}
              <option value="new">A different course or section…</option>
            </select>
          </Field>
        )}
        {(courseId === "new" || courses.length === 0) && (
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr]">
            <input type="hidden" name="courseId" value="new" />
            <Field label="Course code" htmlFor="courseCode">
              <input id="courseCode" name="courseCode" maxLength={20} placeholder="e.g. MGT 3200" defaultValue={v.courseCode} className="field-input" />
            </Field>
            <Field label="Course name" htmlFor="courseName">
              <input id="courseName" name="courseName" maxLength={100} placeholder="e.g. Principles of Management" defaultValue={v.courseName} className="field-input" />
            </Field>
            <Field label="Section" htmlFor="sectionNumber">
              <input id="sectionNumber" name="sectionNumber" maxLength={10} placeholder="e.g. 2" defaultValue={v.sectionNumber} className="field-input" />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">About the project</legend>
        <Field label="Project name" htmlFor="projectName">
          <input id="projectName" name="projectName" maxLength={100} placeholder="Students see this on their team page" defaultValue={v.projectName ?? "Semester Group Project"} className="field-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" htmlFor="startDate">
            <DatePicker id="startDate" name="startDate" value={startDate} onChange={setStartDate} />
          </Field>
          <Field label="Final due date" htmlFor="endDate">
            <DatePicker id="endDate" name="endDate" value={endDate} onChange={setEndDate} min={startDate || undefined} />
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
        <SubmitButton pendingText="Creating…">Next</SubmitButton>
      </div>
    </form>
  );
}
