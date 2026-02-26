import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function StatCard({ label, value, max, icon: Icon, color = "text-slate-600", bgColor = "bg-slate-50", trend }) {
  const numValue = typeof value === 'string' ? parseInt(value) : value;
  const percentage = max ? (numValue / max) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group">
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
              <motion.p 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="text-2xl font-bold text-slate-900"
              >
                {value}
              </motion.p>
              {trend && <p className="text-xs text-emerald-600 font-medium">{trend}</p>}
            </div>
            <div className={cn("p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-300", bgColor)}>
              <Icon className={cn("w-5 h-5", color)} />
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full bg-slate-100 relative overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className={cn("h-full absolute left-0 top-0 bg-gradient-to-r", 
              color.includes('blue') ? 'from-blue-400 to-blue-600' :
              color.includes('violet') ? 'from-violet-400 to-violet-600' :
              color.includes('emerald') ? 'from-emerald-400 to-emerald-600' :
              'from-orange-400 to-orange-600'
            )}
          />
        </div>
      </Card>
    </motion.div>
  );
}