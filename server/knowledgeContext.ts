import { fsListDocs } from "./firebaseAdmin";

const BASELINE_PROFILE = {
  name: "Atharv Kamath",
  titles: ["Content Creator", "Tech Enthusiast", "Gamer", "Music Lover", "Developer"],
  location: "Udupi, Karnataka, India",
  email: "business.atharvk@gmail.com",
  contentCreationStartDate: "2022-01-01",
  bio: "Atharv Kamath is a content creator, tech enthusiast, gamer, music lover, and developer from Udupi, Karnataka, India, sharing digital projects, vlogs, tech reviews, gaming streams, music beats, and articles.",
  mission: "Creating informative, entertaining, and valuable technology and creative content.",
  socialLinks: {
    youtube: "https://www.youtube.com/@atharvkamath",
    instagram: "https://www.instagram.com/atharvk.yt/",
    facebook: "https://facebook.com/atharvkamath",
    github: "https://github.com/atharvkamath",
    linkedin: "https://linkedin.com/in/atharvkamath",
  },
};

const BASELINE_PROJECTS = [
  {
    title: "Atharv Kamath Hub Website",
    description: "Interactive portfolio and creator hub built with React, Vite, Tailwind CSS, Firebase, and an Owner/Admin control dashboard.",
    tags: ["React", "TypeScript", "Tailwind CSS", "Firebase"],
    demoUrl: "https://atharvkamath.com",
    githubUrl: "https://github.com/atharvkamath/digital-hub",
    featured: true,
  },
  {
    title: "Harmonix - Interactive Lo-Fi Beats Player",
    description: "Music player app for relaxing instrumental tracks with ambient sound mixing and study timer.",
    tags: ["React", "Web Audio API", "CSS Grid", "Canvas"],
    demoUrl: "https://harmonix-music.app",
    githubUrl: "https://github.com/atharvkamath/harmonix",
    featured: true,
  },
  {
    title: "ForgeGPT - AI-powered Code Summarizer",
    description: "Developer tool that scans code files, generates documentation, and finds issues using Gemini API integration.",
    tags: ["Node.js", "Express", "Gemini API", "Markdown"],
    githubUrl: "https://github.com/atharvkamath/forgegpt",
    featured: false,
  },
];

const BASELINE_LINKS = [
  { title: "Vlog Channel - Travel & Life", category: "Vlogs", url: "https://www.youtube.com/@atharvkamath" },
  { title: "Tech Channel - Gadget & Software Reviews", category: "Technology", url: "https://youtube.com/@crazytechct" },
  { title: "Gaming Channel - Gameplay & Streams", category: "Gaming", url: "https://youtube.com/playlist?list=PL-gaming-channel" },
  { title: "Music Playlists & Lo-Fi Beats", category: "Music", url: "https://youtube.com/@8daudios20" },
  { title: "My Instagram Photography Feed", category: "Photography", url: "https://www.instagram.com/atharvk.yt/" },
  { title: "Developer Portfolio on GitHub", category: "Technology", url: "https://github.com/atharvkamath" },
  { title: "Official Facebook Fan Page", category: "Social Updates", url: "https://facebook.com/atharvkamath" },
  { title: "Professional LinkedIn Network", category: "Business", url: "https://linkedin.com/in/atharvkamath" },
];

const BASELINE_DOWNLOADS = [
  { title: "Data Structures & Algorithms Cheat Sheet", category: "Notes", fileType: "PDF", fileSize: "2.4 MB", description: "Concise PDF summary of Arrays, Linked Lists, Trees, Sorting Algorithms, and Big-O notation." },
  { title: "Cyberpunk Glow OBS Stream Overlay Template", category: "Templates", fileType: "ZIP", fileSize: "18.5 MB", description: "Overlay folder for Twitch and YouTube streams with neon transitions." },
  { title: "4K Atmospheric Aesthetic Wallpapers", category: "Wallpapers", fileType: "ZIP", fileSize: "45.2 MB", description: "Bundle of original drone photography and digital nature wallpapers from Karnataka." },
  { title: "Ambient Drum Kit & Lofi Sample Pack v1", category: "Software", fileType: "ZIP", fileSize: "128.0 MB", description: "Free Foley rain sounds, soft snare presets, and bass lines." },
];

const BASELINE_BLOGS = [
  { title: "How I Learned Full Stack Web Development Beside College", category: "Technology", date: "2026-06-25" },
  { title: "10 Essential Travel Hacks for Exploring Coastal Karnataka", category: "Travel", date: "2026-04-10" },
];

const BASELINE_ARCADE_GAMES = [
  { title: "Cyber-Snake Arcade", genre: "Retro Arcade", description: "Built-in browser retro snake game." },
  { title: "Minecraft Classic", genre: "Sandbox", description: "Playable browser sandbox experience." },
  { title: "Retro Pac-Man classic", genre: "Classic Arcade", description: "Classic neon maze arcade game." },
];

const BASELINE_TIMELINE = [
  { year: "2022", title: "The Content Journey Begins", subtitle: "First YouTube Channel Launched" },
  { year: "2023", title: "Diving into Technology & Web Dev", subtitle: "Built First Static Websites" },
  { year: "2024", title: "Gaming & Music Beats Production", subtitle: "Expanded Creative Content Hub" },
  { year: "2025", title: "College Tech Fest Leadership", subtitle: "Winner of Hackathon & Event Coordinator" },
  { year: "2026", title: "Official Digital Hub Launched", subtitle: "Atharv Kamath Portfolio Live" },
];

let cachedKnowledge: { text: string; expiresAt: number } | null = null;
const KNOWLEDGE_TTL_MS = 60 * 1000;

export async function buildWebsiteKnowledgeContext(): Promise<string> {
  const now = Date.now();
  if (cachedKnowledge && cachedKnowledge.expiresAt > now) {
    return cachedKnowledge.text;
  }

  let profile: any = BASELINE_PROFILE;
  let projects: any[] = BASELINE_PROJECTS;
  let links: any[] = BASELINE_LINKS;
  let downloads: any[] = BASELINE_DOWNLOADS;
  let blogs: any[] = BASELINE_BLOGS;
  let videos: any[] = [];
  let timeline: any[] = BASELINE_TIMELINE;
  let arcadeGames: any[] = BASELINE_ARCADE_GAMES;
  let uploadedGames: any[] = [];

  try {
    const sections = await fsListDocs("siteContent");
    for (const sec of sections) {
      if (sec.sectionId === "profile" && sec.data) {
        profile = { ...BASELINE_PROFILE, ...sec.data };
      } else if (sec.sectionId === "projects" && Array.isArray(sec.items)) {
        projects = sec.items.filter((p: any) => p?.status !== "draft");
      } else if (sec.sectionId === "links" && Array.isArray(sec.items)) {
        links = sec.items;
      } else if (sec.sectionId === "downloads" && Array.isArray(sec.items)) {
        downloads = sec.items;
      } else if (sec.sectionId === "blogs" && Array.isArray(sec.items)) {
        blogs = sec.items.filter((b: any) => b?.status !== "draft");
      } else if (sec.sectionId === "videos" && Array.isArray(sec.items)) {
        videos = sec.items;
      } else if (sec.sectionId === "timeline" && Array.isArray(sec.items)) {
        timeline = sec.items;
      } else if (sec.sectionId === "arcadeGames" && Array.isArray(sec.items)) {
        arcadeGames = sec.items;
      }
    }
  } catch {
    // Fallback cleanly to verified baseline constants if Firestore public read is unavailable
  }

  try {
    const rawGames = await fsListDocs("games");
    uploadedGames = rawGames.filter(
      (g: any) => g.publicationStatus === "published" && g.securityScanStatus === "passed"
    );
  } catch {
    uploadedGames = [];
  }

  const lines: string[] = [
    "=== VERIFIED WEBSITE DATA FOR ATHARV KAMATH HUB ===",
    "",
    "[PROFILE & ABOUT]",
    `Name: ${profile.name || "Atharv Kamath"}`,
    `Roles/Titles: ${Array.isArray(profile.titles) ? profile.titles.join(", ") : "Content Creator, Developer"}`,
    `Location: ${profile.location || "Udupi, Karnataka, India"}`,
    `Business/Contact Email: ${profile.email || "business.atharvk@gmail.com"}`,
    `Bio: ${profile.bio || BASELINE_PROFILE.bio}`,
    `Mission: ${profile.mission || BASELINE_PROFILE.mission}`,
    profile.contentCreationStartDate ? `Content Creation Start Date: ${profile.contentCreationStartDate}` : "",
    "",
    "[CONTACT METHODS]",
    `- Direct Inquiry Form in the Contact section of the website (saves inquiries to the Owner Dashboard and sends email notifications when configured).`,
    `- Business Email: ${profile.email || "business.atharvk@gmail.com"}`,
    `- Social Channels: YouTube (${profile.socialLinks?.youtube || "https://www.youtube.com/@atharvkamath"}), Instagram (${profile.socialLinks?.instagram || "https://www.instagram.com/atharvk.yt/"}), GitHub (${profile.socialLinks?.github || "https://github.com/atharvkamath"}), LinkedIn (${profile.socialLinks?.linkedin || "https://linkedin.com/in/atharvkamath"}).`,
    "",
    `[PORTFOLIO PROJECTS (${projects.length})]`,
    ...projects.map(
      (p: any) =>
        `- ${p.title}${p.featured ? " [Featured]" : ""}: ${p.description} (Tags: ${Array.isArray(p.tags) ? p.tags.join(", ") : ""}${p.demoUrl ? `, Demo: ${p.demoUrl}` : ""}${p.githubUrl ? `, GitHub: ${p.githubUrl}` : ""})`
    ),
    "",
    `[DIGITAL LIBRARY & DOWNLOADS (${downloads.length})]`,
    ...downloads.map(
      (d: any) =>
        `- ${d.title} [${d.category} | ${d.fileType} | ${d.fileSize}]: ${d.description}`
    ),
    "",
    "[GAMING ZONE]",
    "The Gaming Zone features two parts: (1) Curated Browser Arcade Games playable right in the browser, and (2) Downloadable Games uploaded and security-scanned by administrators.",
    `Curated Arcade Games (${arcadeGames.length}):`,
    ...arcadeGames.map((g: any) => `- ${g.title} (${g.genre}): ${g.description}`),
    uploadedGames.length > 0
      ? `Published Downloadable Games (${uploadedGames.length}):\n${uploadedGames
          .map(
            (g: any) =>
              `- ${g.title} v${g.version || "1.0"} (${g.genre || g.category || "Game"}, ${g.fileSizeFormatted || "Downloadable"}): ${g.description}`
          )
          .join("\n")}`
      : "Published Downloadable Games: None currently published in the downloadable vault.",
    "",
    `[CONTENT HUB LINKS (${links.length})]`,
    ...links.map((l: any) => `- ${l.title} (${l.category}): ${l.url}`),
    "",
    `[BLOGS & ARTICLES (${blogs.length})]`,
    ...blogs.map((b: any) => `- ${b.title} (${b.category}, ${b.date})`),
  ];

  if (videos.length > 0) {
    lines.push("", `[VIDEOS (${videos.length})]`, ...videos.map((v: any) => `- ${v.title} (${v.category})`));
  }

  if (timeline.length > 0) {
    lines.push("", `[JOURNEY TIMELINE]`, ...timeline.map((t: any) => `- ${t.year}: ${t.title} — ${t.subtitle}`));
  }

  const contextText = lines.filter((line) => line !== undefined).join("\n");
  cachedKnowledge = {
    text: contextText,
    expiresAt: now + KNOWLEDGE_TTL_MS,
  };
  return contextText;
}
