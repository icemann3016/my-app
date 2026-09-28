import { LegalPageView, legalMetadata } from "@/components/legal-page";

export const generateMetadata = () => legalMetadata("cookies");

export default function Page() {
  return <LegalPageView page="cookies" />;
}
