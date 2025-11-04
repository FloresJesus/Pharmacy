"use client";
import { CircleUser } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-end p-4 border-b-2 border-gray-500 bg-white">
      <div className="flex items-center space-x-4">
        <span className="text-gray-700 font-medium">Admin</span>
        <CircleUser className="h-8 w-8 text-gray-700" />
      </div>
    </header>
  );
}