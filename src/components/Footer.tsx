import Link from "next/link";
import { POINTS_DISCLAIMER } from "@/lib/product-language";

export default function Footer() {
  return (
    <footer className="border-t border-mist bg-cloud py-6">
      <div className="mx-auto max-w-6xl space-y-2 px-4">
        <p className="text-xs leading-relaxed text-ink/50">
          {POINTS_DISCLAIMER}
        </p>
        <Link href="/terms" className="text-xs text-ink/60 underline-offset-2 hover:text-owla hover:underline">
          Termos de Uso
        </Link>
      </div>
    </footer>
  );
}
