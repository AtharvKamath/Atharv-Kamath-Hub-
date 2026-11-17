/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// @ts-ignore
import defaultProfilePhoto from './profile.svg';

import {
  Profile,
  Stat,
  ContentLink,
  Photo,
  Project,
  Video,
  DownloadItem,
  FavoriteItem,
  BlogPost,
  TimelineItem,
  Game,
} from './types';

export const initialProfile: Profile = {
  name: "Atharv Kamath",
  titles: [
    "Content Creator",
    "Tech Enthusiast",
    "Gamer",
    "Music Lover",
    "Developer"
  ],
  bio: "Welcome to my official digital hub. I'm Atharv Kamath from Udupi, Karnataka, India. I am passionate about creating engaging digital content, exploring cutting-edge technologies, gaming, producing music, and sharing my journey with curious minds around the globe.",
  mission: "I believe technology and creativity can inspire people and bring ideas to life. Through every video, article, project, and photograph, I strive to create content that is informative, entertaining, and valuable for everyone. Join me in learning, creating, exploring, and growing together.",
  location: "Udupi, Karnataka, India",
  email: "business.atharvk@gmail.com",
  profilePhoto: "https://yt3.ggpht.com/Vw9gBHSP3fK6el6UPAXXAVsINIywLFwGo26AKb4C_KQfJy8yaMmxS6QY306OyiJS6mY_2_bw=s600-c-k-c0x00ffffff-no-rj-rp-mo",
  logoUrl: "",
  contentCreationStartDate: "2022-01-01",
  banners: [
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80", // Majestic Green Nature Mountain Valley
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80", // Coastal Sunset (representing Udupi coastal vibe)
    "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1920&q=80", // Sleek Neon Gaming Setup (Gamer)
    "https://images.unsplash.com/photo-1618401471353-b98aedd07871?auto=format&fit=crop&w=1920&q=80", // Ambient Developer Tech Workspace (Developer)
    "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1920&q=80"  // Cinematic Music Recording Studio (Music Lover)
  ],
  socialLinks: {
    youtube: "https://www.youtube.com/@atharvkamath",
    instagram: "https://www.instagram.com/atharvk.yt/",
    facebook: "https://facebook.com/atharvkamath",
    github: "https://github.com/atharvkamath",
    linkedin: "https://linkedin.com/in/atharvkamath",
    email: "mailto:business.atharvk@gmail.com"
  }
};

export const initialStats: Stat[] = [
  {
    id: "stat-2",
    label: "Videos Uploaded",
    value: 0,
    suffix: "",
    iconName: "Video"
  },
  {
    id: "stat-4",
    label: "Projects Completed",
    value: 0,
    suffix: "",
    iconName: "Cpu"
  },
  {
    id: "stat-5",
    label: "Years of Content Creation",
    value: 0,
    suffix: "+",
    iconName: "Calendar"
  }
];

export const initialContentLinks: ContentLink[] = [
  {
    id: "link-1",
    title: "Vlog Channel - Travel & Life",
    description: "Explore breathtaking travel vlogs, food explorations, and daily life stories from across Karnataka and beyond.",
    url: "https://www.youtube.com/@atharvkamath",
    platform: "youtube",
    category: "Vlogs",
    clicks: 0
  },
  {
    id: "link-2",
    title: "Tech Channel - Gadget & Software Reviews",
    description: "Deep dive reviews of latest smartphones, PC builds, useful developer setups, and software tutorials.",
    url: "https://youtube.com/@crazytechct?si=PFL0mSqGnqsV6jw8",
    platform: "youtube",
    category: "Technology",
    clicks: 0
  },
  {
    id: "link-3",
    title: "Gaming Channel - Gameplay & Streams",
    description: "Join me live for tactical shooter matches, sandbox building, game reviews, and community custom rooms.",
    url: "https://youtube.com/playlist?list=PL-gaming-channel",
    platform: "youtube",
    category: "Gaming",
    clicks: 0
  },
  {
    id: "link-4",
    title: "Music Playlists & Lo-Fi Beats",
    description: "Listen to my original ambient lo-fi music tracks, remixes, edits, and curated coding playlists.",
    url: "https://youtube.com/@8daudios20?si=I5u_P2MXS_5tb9Qu",
    platform: "youtube",
    category: "Music",
    clicks: 0
  },
  {
    id: "link-5",
    title: "My Instagram Photography Feed",
    description: "Capturing details, streetscapes, gaming setups, and travel moments in Udupi and Karnataka.",
    url: "https://www.instagram.com/atharvk.yt/",
    platform: "instagram",
    category: "Photography",
    clicks: 0
  },
  {
    id: "link-6",
    title: "Developer Portfolio on GitHub",
    description: "Explore my open-source projects, web applications, custom algorithms, and UI boilerplate codes.",
    url: "https://github.com/atharvkamath",
    platform: "github",
    category: "Technology",
    clicks: 0
  },
  {
    id: "link-7",
    title: "Official Facebook Fan Page",
    description: "Stay updated on announcements, event photos, and interactive community polls.",
    url: "https://facebook.com/atharvkamath",
    platform: "facebook",
    category: "Social Updates",
    clicks: 0
  },
  {
    id: "link-8",
    title: "Professional LinkedIn Network",
    description: "Let's connect for business collaborations, sponsorships, and tech-related industry inquiries.",
    url: "https://linkedin.com/in/atharvkamath",
    platform: "linkedin",
    category: "Business",
    clicks: 0
  }
];

export const initialPhotos: Photo[] = [
  {
    id: "photo-1",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    title: "Sun-kissed Malpe Beach, Udupi",
    category: "Travel",
    date: "2026-03-12"
  },
  {
    id: "photo-2",
    url: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=800&q=80",
    title: "Misty Western Ghats Forest Canopy",
    category: "Nature",
    date: "2025-09-18"
  },
  {
    id: "photo-3",
    url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
    title: "Synthesizing Lo-Fi Waves in VS Code",
    category: "Tech",
    date: "2026-01-05"
  },
  {
    id: "photo-4",
    url: "https://images.unsplash.com/photo-1600861195091-690c92f1d2cc?auto=format&fit=crop&w=800&q=80",
    title: "Dual Monitor Pastel Sunset Gaming Rig",
    category: "Gaming Setup",
    date: "2026-05-20"
  },
  {
    id: "photo-5",
    url: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80",
    title: "Late Night College Hackathon Success",
    category: "College Life",
    date: "2025-11-14"
  },
  {
    id: "photo-6",
    url: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80",
    title: "Hosting the Annual Tech Fest Event",
    category: "Events",
    date: "2026-02-28"
  },
  {
    id: "photo-7",
    url: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
    title: "Focusing the Glass - Vintage Prime Lens",
    category: "Photography",
    date: "2025-07-22"
  },
  {
    id: "photo-8",
    url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
    title: "Boating in the Backwaters of Kerala",
    category: "Travel",
    date: "2025-12-25"
  }
];

export const initialProjects: Project[] = [
  {
    id: "project-1",
    title: "Atharv Kamath Hub Website",
    description: "A highly interactive, glassmorphic portfolio and creator hub built with React, Vite, Tailwind CSS, and featuring a custom admin control board for dynamic updates.",
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80",
    tags: ["React", "TypeScript", "Tailwind CSS", "Motion", "LocalStorage"],
    demoUrl: "https://atharvkamath.com",
    githubUrl: "https://github.com/atharvkamath/digital-hub",
    featured: true
  },
  {
    id: "project-2",
    title: "Harmonix - Interactive Lo-Fi Beats Player",
    description: "A music player app that allows users to play relaxing instrumental tracks, mix in environmental audio layers (rain, campfire, coffee shop), and set a study sleep timer.",
    image: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?auto=format&fit=crop&w=800&q=80",
    tags: ["React", "Web Audio API", "CSS Grid", "Canvas"],
    demoUrl: "https://harmonix-music.app",
    githubUrl: "https://github.com/atharvkamath/harmonix",
    featured: true
  },
  {
    id: "project-3",
    title: "ForgeGPT - AI-powered Code Summarizer",
    description: "An AI-driven developer tool that scans whole files, generates concise documentation, finds bugs, and formats structured notes using Gemini API integration.",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    tags: ["Node.js", "Express", "Gemini API", "Markdown"],
    githubUrl: "https://github.com/atharvkamath/forgegpt",
    featured: false
  }
];

export const initialVideos: Video[] = [
  {
    id: "video-1",
    title: "Exploring Udupi & Coastal Karnataka - Travel Vlog",
    description: "Journey with me to the pristine beaches, ancient temples, and mouth-watering street food scenes in Udupi.",
    youtubeId: "dQw4w9WgXcQ", // Placeholder Youtube video id
    category: "Vlogs"
  },
  {
    id: "video-2",
    title: "My Ultimate Desk Setup for Coding & Gaming (2026)",
    description: "Reviewing my custom PC build, desk organization, RGB setups, and ergonomics tips for creators.",
    youtubeId: "dQw4w9WgXcQ",
    category: "Tech"
  },
  {
    id: "video-3",
    title: "Clutching the Finals! Tactical FPS Community Tournament",
    description: "Watch the best highlights, tactical plays, and custom-room banter from our latest gaming live stream.",
    youtubeId: "dQw4w9WgXcQ",
    category: "Gaming"
  },
  {
    id: "video-4",
    title: "Producing a Lofi Beat in Under 10 Minutes from Scratch",
    description: "A step-by-step walkthrough of my DAW setup, chord choices, drum sequencing, and custom ambient samples.",
    youtubeId: "dQw4w9WgXcQ",
    category: "Music"
  }
];

export const initialDownloads: DownloadItem[] = [
  {
    id: "dl-1",
    title: "Data Structures & Algorithms Cheat Sheet",
    description: "A complete concise PDF summary of Arrays, Linked Lists, Trees, Sorting Algorithms, and Big-O notation.",
    fileSize: "2.4 MB",
    fileType: "PDF",
    category: "Notes",
    downloadUrl: "#",
    downloadsCount: 0
  },
  {
    id: "dl-2",
    title: "Cyberpunk Glow OBS Stream Overlay Template",
    description: "A customized high-quality overlay folder for Twitch and YouTube streams with smooth neon transitions.",
    fileSize: "18.5 MB",
    fileType: "ZIP",
    category: "Templates",
    downloadUrl: "#",
    downloadsCount: 0
  },
  {
    id: "dl-3",
    title: "4K Atmospheric Aesthetic Wallpapers",
    description: "A bundle of original high-resolution drone photography and digital nature wallpapers from Karnataka.",
    fileSize: "45.2 MB",
    fileType: "ZIP",
    category: "Wallpapers",
    downloadUrl: "#",
    downloadsCount: 0
  },
  {
    id: "dl-4",
    title: "Ambient Drum Kit & Lofi Sample Pack v1",
    description: "Free sound files, Foley rain sounds, soft snare presets, and bass lines produced in my studio.",
    fileSize: "128.0 MB",
    fileType: "ZIP",
    category: "Software",
    downloadUrl: "#",
    downloadsCount: 0
  }
];

export const initialFavorites: FavoriteItem[] = [
  {
    id: "fav-1",
    title: "Custom GK61 Mechanical Keyboard",
    category: "Gadget",
    rating: 5,
    description: "With Lubed Gateron Yellow Switches and Japanese Retro PBT Keycaps. Typing on this feels like typing on butter.",
    image: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "fav-2",
    title: "Ali Abdaal - Productivity Creator",
    category: "YouTuber",
    rating: 5,
    description: "His tips on deep work, systematic learning, and content monetization heavily inspire my digital content strategy.",
    image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "fav-3",
    title: "Sony WH-1000XM4 Noise Canceling Headphones",
    category: "Gadget",
    rating: 5,
    description: "Absolute lifesaver for cutting out outside noise while editing vlogs, writing code, or listening to music mixes.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80"
  },
  {
    id: "fav-4",
    title: "Minecraft - Creative Sandbox",
    category: "Game",
    rating: 4,
    description: "The ultimate sandbox game where I can relax, construct medieval villages, and listen to C418's masterpiece sound score.",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=500&q=80"
  }
];

export const initialBlogs: BlogPost[] = [
  {
    id: "blog-1",
    title: "How I Learned Full Stack Web Development Beside College",
    excerpt: "Balancing exams and assignments while building full-fledged applications. Here is my personal step-by-step roadmap.",
    content: `## My Journey into Web Development

It is often challenging to learn complex frameworks like **React, Node.js, and Databases** while keeping up with college schedules, exams, and attendance. But the key isn't having unlimited hours; it's about **consistent compounding interest**.

### 1. The Power of Project-Based Learning
Instead of binge-watching 60-hour online courses, I picked simple things I wanted to see exist:
- A custom workout planner
- A lo-fi music mixer
- This personal hub website

By struggling through actual setups, you learn **real problem-solving**, which reading documentation alone never provides.

### 2. Time-Blocking Strategy
I set aside just **90 minutes every single night** from 10:00 PM to 11:30 PM. No social media, no distractions. During this high-focus block, I build. Over 6 months, that's **270 hours of pure programming practice**!

### 3. Sharing Your Progress
Start putting your code on GitHub and writing small posts about your learnings. It creates a valuable **digital trail** that attracts collaborations, sponsorships, and job opportunities!`,
    coverImage: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=800&q=80",
    category: "Technology",
    date: "2026-06-25",
    reads: 0
  },
  {
    id: "blog-2",
    title: "10 Essential Travel Hacks for Exploring Coastal Karnataka",
    excerpt: "From hidden beaches in Malpe to discovering secret food spots in Mangalore, make your coastal road trip unforgettable.",
    content: `## Exploring Coastal Karnataka

Coastal Karnataka is a treasure trove of pristine sandy shores, ancient temples, lush backwaters, and some of the world's finest culinary experiences. Here are my top travel hacks for making your road trip seamless and memorable.

### 1. Best Time to Visit
The coastal belt gets extremely hot and humid in summer. Plan your visit between **October and February** when the weather is pleasant, and sea tides are safe for water sports.

### 2. The Best Malpe Seafood Spots
Avoid touristy commercial restaurants. Instead, take a short walk near Malpe harbor and seek out small local shacks serving fresh pan-fried fish with coconut-based curries (**Kori Rotti** and **Anjal Fry**). They are extremely affordable and offer authentic home-cooked flavors.

### 3. Getting Around
While local buses are highly active, renting a scooter or taking a private car is the best way to access remote beaches like **Kapu Beach** (famous for its historic lighthouse) or **Delta Point** where the river meets the sea.

### 4. Respect Local Rules
Many locations on the coast are deeply connected to ancient spiritual temples (like Sri Krishna Mutt in Udupi). Respect dress codes and photography guidelines in religious areas.`,
    coverImage: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
    category: "Travel",
    date: "2026-04-10",
    reads: 0
  }
];

export const initialTimeline: TimelineItem[] = [
  {
    id: "tl-1",
    year: "2022",
    title: "The Content Journey Begins",
    subtitle: "First YouTube Channel Launched",
    description: "Started recording travel clips on my phone and editing simple videos. Discovered a deep love for storytelling and video editing."
  },
  {
    id: "tl-2",
    year: "2023",
    title: "Diving into Technology & Web Dev",
    subtitle: "Built First Static Websites",
    description: "Began learning HTML, CSS, JavaScript, and Tailwind. Merged tech hobbies with web creation to share projects and coding hacks."
  },
  {
    id: "tl-3",
    year: "2024",
    title: "Gaming & Music Beats Production",
    subtitle: "Expanded Creative Content Hub",
    description: "Started producing ambient music beats, streaming tactical gameplay, and compiling custom developer sound packs."
  },
  {
    id: "tl-4",
    year: "2025",
    title: "College Tech Fest Leadership",
    subtitle: "Winner of Hackathon & Event Coordinator",
    description: "Coordinated major technology events, won an inter-collegiate hackathon with an AI-driven project, and established deep creator connections."
  },
  {
    id: "tl-5",
    year: "2026",
    title: "Official Digital Hub Launched",
    subtitle: "Atharv Kamath Portfolio Live",
    description: "Created a centralized modern portfolio and blogging platform, empowering seamless updates via a private administrative dashboard."
  }
];

export const initialGames: Game[] = [
  {
    id: "game-1",
    title: "Cyber-Snake Arcade",
    description: "Navigate the classic pixel snake in a glowing retro layout, gobble cyber-cubes and build a high score!",
    imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=500&q=80",
    playUrl: "play_local",
    genre: "Retro Arcade",
    rating: 5
  },
  {
    id: "game-2",
    title: "Minecraft Classic",
    description: "The official sandbox building experience, directly playable inside your browser tab.",
    imageUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=500&q=80",
    playUrl: "https://classic.minecraft.net/",
    genre: "Sandbox",
    rating: 5
  },
  {
    id: "game-3",
    title: "Retro Pac-Man classic",
    description: "Help Pac-Man navigate the neon maze, eat dots, and escape from the colored ghosts.",
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=500&q=80",
    playUrl: "https://pacman.com/en/play.php",
    genre: "Classic Arcade",
    rating: 4
  }
];

