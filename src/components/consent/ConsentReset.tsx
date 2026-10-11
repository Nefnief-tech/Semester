"use client";

import { resetConsent } from "@/lib/store/consent";

/** reopens the consent banner by forgetting the stored decision */
export default function ConsentReset() {
  return (
    <button
      className="btn-ghost px-4 py-2 text-sm"
      onClick={() => resetConsent()}
    >
      Cookie-Einstellungen ändern
    </button>
  );
}
