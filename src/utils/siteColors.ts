export interface SiteColorTheme {
  hex: string;
  barClass: string;
  dotClass: string;
  softBgClass: string;
  textClass: string;
}

export const SITE_COLOR_THEMES: SiteColorTheme[] = [
  {
    hex: '#4C8F84',
    barClass: 'bg-[#4C8F84]',
    dotClass: 'bg-[#4C8F84]',
    softBgClass: 'bg-[#E6EAD6]',
    textClass: 'text-[#366B62]',
  },
  {
    hex: '#E36A42',
    barClass: 'bg-[#E36A42]',
    dotClass: 'bg-[#E36A42]',
    softBgClass: 'bg-[#FADCC7]',
    textClass: 'text-[#B54B27]',
  },
  {
    hex: '#D9912B',
    barClass: 'bg-[#D9912B]',
    dotClass: 'bg-[#D9912B]',
    softBgClass: 'bg-[#F6E4C3]',
    textClass: 'text-[#9E6514]',
  },
  {
    hex: '#766BB0',
    barClass: 'bg-[#766BB0]',
    dotClass: 'bg-[#766BB0]',
    softBgClass: 'bg-[#E4E0EF]',
    textClass: 'text-[#554B8A]',
  },
  {
    hex: '#C95D76',
    barClass: 'bg-[#C95D76]',
    dotClass: 'bg-[#C95D76]',
    softBgClass: 'bg-[#F5DCE2]',
    textClass: 'text-[#9A3A51]',
  },
  {
    hex: '#6B8E58',
    barClass: 'bg-[#6B8E58]',
    dotClass: 'bg-[#6B8E58]',
    softBgClass: 'bg-[#E5ECD9]',
    textClass: 'text-[#486538]',
  },
];

export function getSiteColorTheme(index: number): SiteColorTheme {
  return SITE_COLOR_THEMES[Math.abs(index) % SITE_COLOR_THEMES.length];
}
