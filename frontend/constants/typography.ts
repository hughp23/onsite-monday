export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  displayBold: 'BarlowCondensed_700Bold',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemiBold: 'Barlow_600SemiBold',
  bodyBold: 'Barlow_700Bold',
};

export const type = {
  // Screen / section titles
  displayLg: { fontFamily: fonts.display, fontSize: 32, letterSpacing: 0.5, lineHeight: 37 },
  displayMd: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 0.4, lineHeight: 30 },
  displaySm: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.3, lineHeight: 26 },
  // Prices and rates — the money number
  price: { fontFamily: fonts.display, fontSize: 22, letterSpacing: 0.5, lineHeight: 26 },
  priceLg: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 0.5, lineHeight: 39 },
  priceXl: { fontFamily: fonts.display, fontSize: 44, letterSpacing: 0, lineHeight: 50 },
  // Card titles
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  // Body copy
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  bodyMd: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  labelSm: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 0.4 },
  meta: { fontFamily: fonts.body, fontSize: 12 },
  // Buttons
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 0.2 },
  btnTextSm: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
};
