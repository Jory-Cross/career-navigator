import { EyeOff } from "lucide-react";
import { useViewAs } from "@/lib/ViewAsContext";

export default function ViewAsExitButton() {
  const { viewAsUser, setViewAsUser } = useViewAs();
  if (!viewAsUser) return null;

  const exit = () => {
    setViewAsUser(null);
    window.location.href = "/";
  };

  return (
    <button
      onClick={exit}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-semibold shadow-lg hover:bg-amber-600 transition-colors"
    >
      <EyeOff className="w-4 h-4" />
      Exit View As
    </button>
  );
}