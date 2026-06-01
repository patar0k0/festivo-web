"use client";

import { useEffect } from "react";
import { fbqTrack } from "@/lib/pixel";

type Props = {
  festivalId: string;
  title: string;
};

export default function TrackMetaViewContent({ festivalId, title }: Props) {
  useEffect(() => {
    fbqTrack("ViewContent", {
      content_ids: [festivalId],
      content_type: "product",
      content_name: title,
    });
  }, [festivalId, title]);

  return null;
}
