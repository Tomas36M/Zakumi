import type { Metadata } from "next";
import { ServicePage } from "@/components/zakumi/sections/ServicePage";
import { SERVICIOS } from "@/components/zakumi/services";

const data = SERVICIOS["marca"];

export const metadata: Metadata = {
  title: data.seo.title,
  description: data.seo.description,
  alternates: { canonical: "/marca" },
};

export default function Page() {
  return <ServicePage data={data} />;
}
