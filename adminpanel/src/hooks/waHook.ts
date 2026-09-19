// hooks/useWhatsappRef.ts
import { useEffect, useState } from "react";
import { apiFetch, buildPath } from "../utils/api";
import { ENDPOINTS }     from "../services/endpoints";

export interface WaRef {
  slug : string;
  phone: string;
  link : string;
}

/** Returns null while loading or when the staff has no referral row */
export const useWhatsappRef = (staffId?: number|null) => {
  const [waRef, setWaRef] = useState<WaRef|null>(null);

  useEffect(() => {
    if (!staffId) return;

    apiFetch<WaRef>(buildPath(ENDPOINTS.staff.whatsappRef, { staffId }))
      .then(setWaRef)          // {slug,phone,link}
      .catch(() => setWaRef(null));
  }, [staffId]);

  return waRef;                // either WaRef or null
};
