"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Search, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
      <div className="bg-red-50 text-red-500 p-6 rounded-full mb-6 dark:bg-red-900/20">
        <AlertCircle className="w-16 h-16" />
      </div>
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="text-gray-500 max-w-md mb-8 dark:text-gray-400 text-lg">
        Oops! The page you are looking for doesn't exist or has been moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Button onClick={() => router.back()} variant="outline" className="min-w-[140px]">
          Go Back
        </Button>
        <Link href="/">
          <Button className="min-w-[140px]">Home</Button>
        </Link>
        <Link href="/products">
          <Button variant="outline" className="min-w-[140px]">
            <Search className="w-4 h-4 mr-2" />
            Browse
          </Button>
        </Link>
      </div>
    </div>
  );
}
