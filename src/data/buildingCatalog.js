import { buildingTypes } from "../city/buildings.js";

// The landmarks, in the order they should read in the Buildings explorer.
//
// Titles, descriptions and links are NOT repeated here -- they come from
// buildingTypes[key].popupContent, so the explorer and the in-city popup can
// never drift apart. All this list adds is presentation: which entries are
// landmarks worth cataloguing, and where their picture lives.
//
// Image URLs are deliberately root-absolute to match the strings in
// loadBuildingSpritesheets(), so the browser serves them from cache instead of
// fetching the same sprite sheet twice.
const ENTRIES = [
  { key: "radio_tower", image: "/textures/buildings/radio_tower.png" },
  { key: "nyt_tower", image: "/textures/buildings/nyt_tower.png" },
  { key: "cinema", image: "/textures/buildings/cinema.png" },
  { key: "library", image: "/textures/buildings/library.png" },
];

export const buildingCatalog = ENTRIES
  .filter(({ key }) => buildingTypes[key])
  .map(({ key, image }) => {
    const popup = buildingTypes[key].popupContent ?? {};
    return {
      id: key,
      title: popup.title ?? key,
      description: popup.description ?? "",
      image,
      // Building sprites are transparent PNGs of a whole building. Cropping one
      // to fill a square would just show a slice of wall.
      fit: "contain",
      links: popup.linkUrl
        ? [{ url: popup.linkUrl, text: popup.linkText ?? popup.linkUrl }]
        : [],
    };
  });

export default buildingCatalog;
