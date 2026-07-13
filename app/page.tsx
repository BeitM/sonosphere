import type { Metadata } from "next";
import { Studio } from "./studio";

export const metadata: Metadata = {
  title: { absolute: "Sonosphere — turn a song into a world" },
  description: "A music interpretation studio that translates sound, meaning, and emotional structure into an explorable 3D world prompt.",
};

export default function Home() { return <Studio />; }
