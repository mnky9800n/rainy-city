// The people (and whales) of Rainy City.
//
// These are photographs rather than sprites, so they're cropped to fill a
// square thumbnail. Their aspect ratios run from 183x512 to 500x297, and a
// centred crop decapitates the full-body shots -- hence objectPosition per
// entry. The values are measured against where each subject actually sits in
// their frame; if you swap an image, re-check its crop.
export const characterCatalog = [
  {
    id: "jennifer",
    title: "Jennifer",
    image: "./characters/jennifer.jpg",
    fit: "cover",
    objectPosition: "50% 0%",
    description:
      "The voice of Rainy City Radio. She runs the 24/7 stream out of the tower on 99.7FM -- local news, weather with Frank, and trip hop until the small hours. When she's off the air she's out on the wet streets in the bomber jacket, which is where you'll have met her if you've played Streets of Rainy City.",
    links: [
      { url: "https://rcade.dev/games/streets-of-rainy-city", text: "Play Streets of Rainy City →" },
      { url: "https://www.youtube.com/@rainy-city-radio/live", text: "Listen live on 99.7FM →" },
    ],
  },
  {
    id: "frank",
    title: "Frank",
    image: "./characters/frank.jpg",
    fit: "cover",
    objectPosition: "50% 0%",
    description:
      "The weather man. In a city where it has not stopped raining once, this is either the easiest job in town or the hardest, and Frank has never said which. He points at the same green and orange band sliding in off the water every evening and finds something new to say about it.",
    links: [],
  },
  {
    id: "john",
    title: "John",
    image: "./characters/john.jpg",
    fit: "cover",
    objectPosition: "50% 25%",
    description:
      "Mayor of Rainy City. Zoning, road grid, the seafloor, the placement of every tower -- all of it goes through his desk, mostly at night. He built the place and he is still building it.",
    links: [{ url: "https://johnspace.xyz", text: "johnspace.xyz →" }],
  },
  {
    id: "lisa",
    title: "Lisa",
    image: "./characters/lisa.jpg",
    fit: "cover",
    objectPosition: "50% 0%",
    description:
      "Librarian at the Rainy City Public Library. She kept the card catalog when the city offered to digitise it, and she was right to. Ask her for something obscure and she will find it, though she will make you wait while she decides whether you deserve it.",
    links: [],
  },
  {
    id: "whales",
    title: "George and Gracie",
    image: "./characters/whales.jpg",
    fit: "cover",
    // The only entry that crops horizontally: 55% keeps the pair centred
    // rather than framing the empty water off to their left.
    objectPosition: "55% 50%",
    description:
      "The whales. They live in the deep water west of the city and drift northwest in a loose pod, surfacing to blow every so often. Nobody in Rainy City agrees on where they came from or what they are saying, which is more or less the point.",
    links: [{ url: "https://www.projectceti.org/", text: "Project CETI →" }],
  },
];

export default characterCatalog;
