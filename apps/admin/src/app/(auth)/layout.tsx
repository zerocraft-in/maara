import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maara Merch",
};

export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-5 py-6 sm:px-8">
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
