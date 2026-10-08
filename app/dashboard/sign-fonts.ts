import {
  Abril_Fatface,
  Bebas_Neue,
  Cormorant_Garamond,
  Josefin_Sans,
  Lobster,
  Pacifico,
  Playfair_Display,
  Righteous,
} from "next/font/google";
import type { SignFontId } from "@/lib/plans";

/**
 * The sign fonts, loaded the Next way. Only the one a venue uses is fetched
 * by the browser: the others are declared but never painted.
 */
const classico = Playfair_Display({ subsets: ["latin"], weight: "800", display: "swap" });
const elegante = Cormorant_Garamond({ subsets: ["latin"], weight: "700", display: "swap" });
const insegna = Abril_Fatface({ subsets: ["latin"], weight: "400", display: "swap" });
const moderno = Bebas_Neue({ subsets: ["latin"], weight: "400", display: "swap" });
const corsivo = Pacifico({ subsets: ["latin"], weight: "400", display: "swap" });
const anni50 = Lobster({ subsets: ["latin"], weight: "400", display: "swap" });
const retro = Righteous({ subsets: ["latin"], weight: "400", display: "swap" });
const liberty = Josefin_Sans({ subsets: ["latin"], weight: "700", display: "swap" });

export const SIGN_FONT_CLASS: Record<SignFontId, string> = {
  classico: classico.className,
  elegante: elegante.className,
  insegna: insegna.className,
  moderno: moderno.className,
  corsivo: corsivo.className,
  anni50: anni50.className,
  retro: retro.className,
  liberty: liberty.className,
};

/** Handwritten faces read wrong in capitals: the sign keeps their case. */
export const SIGN_FONT_KEEPS_CASE: Record<SignFontId, boolean> = {
  classico: false,
  elegante: false,
  insegna: false,
  moderno: false,
  corsivo: true,
  anni50: true,
  retro: false,
  liberty: false,
};
