import ManagerLayout from "@/components/managers/ManagerLayout";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manager Portal - FlexSell Wholesale",
  description: "Manager dashboard for FlexSell Wholesale",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ManagerLayout>{children}</ManagerLayout>;
}
