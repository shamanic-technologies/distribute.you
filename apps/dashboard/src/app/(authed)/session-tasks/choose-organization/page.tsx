import { TaskChooseOrganization } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function ChooseOrganizationTaskPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{
        background: "oklch(98% 0.003 264)",
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link
            href="https://distribute.you"
            className="inline-flex items-center gap-2"
          >
            <Image
              src="/logo-distribute.svg"
              alt="distribute"
              width={28}
              height={28}
            />
            <span className="text-lg font-semibold text-gray-950">
              distribute
            </span>
          </Link>
        </div>
        <TaskChooseOrganization redirectUrlComplete="/orgs" />
      </div>
    </div>
  );
}
