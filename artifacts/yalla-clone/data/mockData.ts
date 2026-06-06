import type { Room } from "@/components/RoomCard";
import type { Video } from "@/components/VideoCard";
import type { Game } from "@/components/GameCard";

export interface NearbyUser {
  id: string;
  name: string;
  avatar: string;
  flag: string;
  level: number;
  isVip: boolean;
  status: string;
  isOnline: boolean;
  isVoiceChatting?: boolean;
}

export interface Post {
  id: string;
  user: string;
  avatar: string;
  level: number;
  isVip: boolean;
  isOnline: boolean;
  images: string[];
  tag: string;
  time: string;
  distance: string;
  likes: number;
  comments: number;
}

export const NEARBY_USERS: NearbyUser[] = [
  {
    id: "u1",
    name: "بهيرة",
    avatar: "https://i.pravatar.cc/150?img=1",
    flag: "🇦🇪",
    level: 84,
    isVip: true,
    status: "أراك في القريب العاجل",
    isOnline: true,
  },
  {
    id: "u2",
    name: "أماني",
    avatar: "https://i.pravatar.cc/150?img=5",
    flag: "🇦🇹",
    level: 20,
    isVip: false,
    status: "لم تقل أي شيء بعد",
    isOnline: true,
  },
  {
    id: "u3",
    name: "إنتصار",
    avatar: "https://i.pravatar.cc/150?img=12",
    flag: "🇦🇺",
    level: 21,
    isVip: false,
    status: "سعيدة بلقائك",
    isOnline: false,
  },
  {
    id: "u4",
    name: "جيني",
    avatar: "https://i.pravatar.cc/150?img=16",
    flag: "🇹🇭",
    level: 22,
    isVip: true,
    status: "تعال وتحدث معي...",
    isOnline: true,
    isVoiceChatting: true,
  },
  {
    id: "u5",
    name: "بسمة",
    avatar: "https://i.pravatar.cc/150?img=25",
    flag: "🇨🇲",
    level: 34,
    isVip: false,
    status: "هل كان يومك جيداً؟",
    isOnline: true,
  },
  {
    id: "u6",
    name: "حنان",
    avatar: "https://i.pravatar.cc/150?img=30",
    flag: "🇸🇦",
    level: 20,
    isVip: true,
    status: "منذ وقت طويل لم نلتقِ",
    isOnline: false,
  },
  {
    id: "u7",
    name: "ليلى",
    avatar: "https://i.pravatar.cc/150?img=44",
    flag: "🇲🇦",
    level: 18,
    isVip: false,
    status: "أحب الموسيقى والكتب",
    isOnline: true,
  },
  {
    id: "u8",
    name: "نور",
    avatar: "https://i.pravatar.cc/150?img=40",
    flag: "🇪🇬",
    level: 30,
    isVip: true,
    status: "ابتسم، الحياة جميلة",
    isOnline: true,
  },
];

export const POSTS: Post[] = [
  {
    id: "p1",
    user: "بسمة",
    avatar: "https://i.pravatar.cc/150?img=25",
    level: 34,
    isVip: true,
    isOnline: true,
    images: ["https://picsum.photos/seed/post1/600/400"],
    tag: "أحب السفر",
    time: "منذ 3 دقائق",
    distance: "800م",
    likes: 12,
    comments: 12,
  },
  {
    id: "p2",
    user: "يونس مودي",
    avatar: "https://i.pravatar.cc/150?img=15",
    level: 19,
    isVip: true,
    isOnline: true,
    images: [
      "https://picsum.photos/seed/post2a/300/300",
      "https://picsum.photos/seed/post2b/300/300",
    ],
    tag: "مرحباً",
    time: "منذ 10 دقائق",
    distance: "1.2 كم",
    likes: 8,
    comments: 5,
  },
  {
    id: "p3",
    user: "نور علي",
    avatar: "https://i.pravatar.cc/150?img=40",
    level: 30,
    isVip: false,
    isOnline: false,
    images: ["https://picsum.photos/seed/post3/600/400"],
    tag: "المطبخ اليوم",
    time: "منذ 25 دقيقة",
    distance: "2 كم",
    likes: 34,
    comments: 7,
  },
  {
    id: "p4",
    user: "ريم الجابر",
    avatar: "https://i.pravatar.cc/150?img=44",
    level: 25,
    isVip: true,
    isOnline: true,
    images: ["https://picsum.photos/seed/post4/600/400"],
    tag: "لحظات الحياة",
    time: "منذ ساعة",
    distance: "3 كم",
    likes: 55,
    comments: 20,
  },
];

export const ROOMS: Room[] = [
  {
    id: "r1",
    name: "سارة وأصحابها",
    hostName: "سارة محمد",
    hostAvatar: "https://i.pravatar.cc/150?img=5",
    speakerCount: 6,
    listenerCount: 500,
    description: "احتفال بعيد الميلاد السعيد معنا",
    tags: ["PK", "Super W", "Chat", "Lv.6"],
    isLive: true,
    category: "music",
    speakerAvatars: [
      "https://i.pravatar.cc/150?img=5",
      "https://i.pravatar.cc/150?img=6",
      "https://i.pravatar.cc/150?img=7",
      "https://i.pravatar.cc/150?img=8",
    ],
  },
  {
    id: "r2",
    name: "كريم علي وأصدقاؤه",
    hostName: "كريم علي",
    hostAvatar: "https://i.pravatar.cc/150?img=12",
    speakerCount: 4,
    listenerCount: 328,
    description: "أراك مرة أخرى",
    tags: ["Chat", "Lv.6"],
    isLive: true,
    category: "chat",
    speakerAvatars: [
      "https://i.pravatar.cc/150?img=12",
      "https://i.pravatar.cc/150?img=13",
    ],
  },
  {
    id: "r3",
    name: "فارس النجار",
    hostName: "فارس",
    hostAvatar: "https://i.pravatar.cc/150?img=21",
    speakerCount: 8,
    listenerCount: 300,
    description: "احتفال بعيد الميلاد السعيد",
    tags: ["Chat", "Lv.6"],
    isLive: true,
    category: "gaming",
    speakerAvatars: [
      "https://i.pravatar.cc/150?img=21",
      "https://i.pravatar.cc/150?img=22",
    ],
  },
  {
    id: "r4",
    name: "بسمة",
    hostName: "بسمة",
    hostAvatar: "https://i.pravatar.cc/150?img=25",
    speakerCount: 5,
    listenerCount: 300,
    description: "تعال وتحدث معي بالصوت",
    tags: ["Chat", "Lv.6"],
    isLive: false,
    category: "family",
    speakerAvatars: ["https://i.pravatar.cc/150?img=25"],
  },
  {
    id: "r5",
    name: "معلم الرقص",
    hostName: "معلم الرقص",
    hostAvatar: "https://i.pravatar.cc/150?img=33",
    speakerCount: 3,
    listenerCount: 182,
    description: "لا تكن مثل الدعم فقط...",
    tags: ["Chat", "Lv.8"],
    isLive: true,
    category: "music",
    speakerAvatars: ["https://i.pravatar.cc/150?img=33"],
  },
  {
    id: "r6",
    name: "يوم جيد",
    hostName: "أحمد",
    hostAvatar: "https://i.pravatar.cc/150?img=50",
    speakerCount: 2,
    listenerCount: 97,
    description: "تحدث معنا اليوم",
    tags: ["Chat", "Lv.5"],
    isLive: false,
    category: "chat",
    speakerAvatars: ["https://i.pravatar.cc/150?img=50"],
  },
];

export const VIDEOS: Video[] = [
  {
    id: "v1",
    title: "أجمل مناظر الطبيعة العربية في الصحراء",
    author: "ريم الجابر",
    authorAvatar: "https://i.pravatar.cc/150?img=44",
    thumbnail: "https://picsum.photos/seed/v1/400/600",
    likes: 4820,
    comments: 230,
    views: "23k",
    duration: "2:45",
  },
  {
    id: "v2",
    title: "وصفة المندي اليمني الأصيل",
    author: "الشيف أحمد",
    authorAvatar: "https://i.pravatar.cc/150?img=45",
    thumbnail: "https://picsum.photos/seed/v2/400/600",
    likes: 7300,
    comments: 450,
    views: "41k",
    duration: "8:20",
  },
  {
    id: "v3",
    title: "رحلة إلى شواطئ السلطنة",
    author: "مسافر دائم",
    authorAvatar: "https://i.pravatar.cc/150?img=46",
    thumbnail: "https://picsum.photos/seed/v3/400/600",
    likes: 3100,
    comments: 180,
    views: "15k",
    duration: "5:10",
  },
  {
    id: "v4",
    title: "تعلم الكاليغرافيا العربية",
    author: "الخطاط زياد",
    authorAvatar: "https://i.pravatar.cc/150?img=47",
    thumbnail: "https://picsum.photos/seed/v4/400/600",
    likes: 9200,
    comments: 620,
    views: "68k",
    duration: "12:05",
  },
  {
    id: "v5",
    title: "جلسة موسيقى عربية أصيلة",
    author: "نغم العرب",
    authorAvatar: "https://i.pravatar.cc/150?img=48",
    thumbnail: "https://picsum.photos/seed/v5/400/600",
    likes: 11500,
    comments: 820,
    views: "95k",
    duration: "4:30",
  },
  {
    id: "v6",
    title: "أفضل العروض الضوئية في دبي",
    author: "دبي لايف",
    authorAvatar: "https://i.pravatar.cc/150?img=49",
    thumbnail: "https://picsum.photos/seed/v6/400/600",
    likes: 18700,
    comments: 1240,
    views: "142k",
    duration: "3:55",
  },
];

export const GAMES: Game[] = [
  {
    id: "g1",
    name: "تحدي المعلومات",
    description: "أسئلة عشوائية متجددة — كن الأسرع في الإجابة واربح النقاط",
    players: 2847,
    maxPlayers: 4,
    icon: "bulb",
    color: "#F59E0B",
    category: "ثقافي",
  },
  {
    id: "ludo",
    name: "لودو",
    description: "لعبة اللودو الكلاسيكية أونلاين حتى 4 لاعبين",
    players: 4120,
    maxPlayers: 4,
    icon: "dice",
    color: "#EC4899",
    category: "لوحية",
  },
];
