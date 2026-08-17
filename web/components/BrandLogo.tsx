import Image from "next/image";
import Link from "next/link";

export default function BrandLogo({
  className = "",
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <Link className={`oba-brand-logo ${className}`.trim()} href="/" aria-label="Open Bible Assessment home">
      <Image className="oba-brand-logo-mark" src="/brand/oba-emblem.png" alt="" width={42} height={42} aria-hidden="true" priority />
      {showText && <span className="oba-brand-logo-text">Open Bible Assessment</span>}
    </Link>
  );
}
