import Link from "next/link";

interface StudyBeeLogoProps {
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}

export function StudyBeeLogo({
  className = "",
  imageClassName = "h-9 w-9",
  textClassName = "text-xl font-black tracking-tight",
}: StudyBeeLogoProps) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/studybee-mascot.png"
        alt="StudyBee"
        className={`object-contain ${imageClassName}`}
      />
      <span className={textClassName}>
        Study<span className="text-yellow-500">Bee</span>
      </span>
    </Link>
  );
}
