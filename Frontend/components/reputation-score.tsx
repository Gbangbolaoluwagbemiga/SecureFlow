"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Award, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"

interface ReputationScoreProps {
  address: string
  completedEscrows: number
  totalVolume: string
  className?: string
}

export function ReputationScore({ address, completedEscrows, totalVolume, className }: ReputationScoreProps) {
  const calculateScore = () => {
    // Simple reputation calculation based on completed escrows
    const baseScore = completedEscrows * 10
    const volumeBonus = Math.min(Number.parseFloat(totalVolume) / 1000, 50)
    return Math.min(Math.round(baseScore + volumeBonus), 100)
  }

  const getReputationLevel = (score: number) => {
    if (score >= 90) return { label: "Elite", color: "text-accent", icon: Award }
    if (score >= 70) return { label: "Expert", color: "text-primary", icon: Star }
    if (score >= 50) return { label: "Trusted", color: "text-primary", icon: TrendingUp }
    if (score >= 30) return { label: "Established", color: "text-muted-foreground", icon: Star }
    return { label: "Newcomer", color: "text-muted-foreground", icon: Star }
  }

  const score = calculateScore()
  const level = getReputationLevel(score)
  const Icon = level.icon

  return (
    <Card className={`glass border-primary/20 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Reputation Score</h3>
        <Badge variant="outline" className="gap-1">
          <Icon className="h-3 w-3" />
          {level.label}
        </Badge>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
            <motion.circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - score / 100)}`}
              className={level.color}
              initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - score / 100) }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold">{score}</span>
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completed Escrows</span>
            <span className="font-semibold">{completedEscrows}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Volume</span>
            <span className="font-semibold">{totalVolume}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Trust Level</span>
            <span className={`font-semibold ${level.color}`}>{level.label}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
