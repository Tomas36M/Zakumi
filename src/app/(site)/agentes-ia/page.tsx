import type { Metadata } from "next";
import { ServicePage } from "@/components/zakumi/sections/ServicePage";
import { SERVICIOS } from "@/components/zakumi/services";

const data = SERVICIOS["agentes-ia"];

export const metadata: Metadata = {
  title: data.seo.title,
  description: data.seo.description,
  alternates: { canonical: "/agentes-ia" },
};

export default function Page() {
  return <ServicePage data={data} />;
}
