import Image from "next/image";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

export interface ProviderAvatarProps {
  provider: string;
  providerDomain: string;
  size?: number;
  className?: string;
}

export function ProviderAvatar({
  provider,
  providerDomain,
  size = 32,
  className = "",
}: ProviderAvatarProps) {
  const rounded = size <= 20 ? "rounded" : "rounded-md";
  if (providerDomain && LOGO_DEV_TOKEN) {
    return (
      <Image
        src={`https://img.logo.dev/${providerDomain}?token=${LOGO_DEV_TOKEN}&size=${size * 2}`}
        alt={provider}
        width={size}
        height={size}
        className={`${rounded} flex-shrink-0 ${className}`.trim()}
        unoptimized
      />
    );
  }
  return (
    <div
      className={`bg-gray-100 ${rounded} flex items-center justify-center text-gray-500 font-bold flex-shrink-0 ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.max(10, size / 2.5) }}
    >
      {provider[0]?.toUpperCase()}
    </div>
  );
}
