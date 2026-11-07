import { FileChecklist, FileChecklistCompact } from "@/components/fill/FileChecklist";
import { ChatMessages, Composer } from "@/components/fill/FillSessionView";
import { FillWindow } from "@/components/fill/FillWindow";
import { FormDocument } from "@/components/fill/FormDocument";
import { filledCount } from "@/lib/fill/display";
import { demoChoices, demoCurrent, demoFields, demoFiles, demoMessages, demoRecentId } from "@/lib/fill/demo";
import { fieldState } from "@/lib/fill/types";

// Landing page product view: the real questions page, drawn with the same
// components and the scripted Irvine ADU demo partway through (the second of
// three uploaded forms). It's a picture, so it's inert: nothing can be clicked
// or focused. Demo data only.
export function FormPreview() {
  const name = demoFiles[demoCurrent].name;
  const filled = demoFields.filter((f) => fieldState(f) === "filled").length;
  const checklist = { items: demoFiles, viewing: demoCurrent };

  return (
    <figure>
      <div inert>
        <FillWindow
          className="xl:h-[760px]"
          title={name}
          count={filledCount(filled, demoFields.length)}
          sidebar={<FileChecklist {...checklist} variant="sidebar" />}
          compactBar={<FileChecklistCompact {...checklist} />}
          docOnSmall="stack"
          log={
            // Shows the end of the conversation, as the real chat does once
            // it has scrolled down; earlier messages are cut off at the top.
            <div className="relative flex max-h-[520px] min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden p-4 sm:p-5 xl:max-h-none">
              <ChatMessages messages={demoMessages} />
            </div>
          }
          composer={<Composer mock={false} asking choices={demoChoices} />}
          document={
            <FormDocument kicker="Your uploaded form" title={name} fields={demoFields} recentId={demoRecentId} />
          }
        />
      </div>

      <figcaption className="sr-only">
        A preview of Fast Track working through three uploaded forms. On the
        left, the list of forms: one done, one being filled, one not started.
        In the middle, the conversation: Fast Track has asked about the new
        unit and now asks whether it will be one story or two. On the right,
        the Irvine ADU application filling in from the answers. The signature
        and date are left for the applicant.
      </figcaption>
    </figure>
  );
}
