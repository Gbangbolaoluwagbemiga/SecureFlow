export interface Milestone {
  description: string
  amount: string
  status: "pending" | "submitted" | "approved" | "disputed"
  submittedAt?: number
  approvedAt?: number
}

export interface Escrow {
  id: string
  payer: string
  beneficiary: string
  token: string
  totalAmount: string
  releasedAmount: string
  status: "pending" | "active" | "completed" | "disputed"
  createdAt: number
  duration: number
  milestones: Milestone[]
  projectDescription?: string
  isOpenJob?: boolean // true if no freelancer assigned yet
  applications?: Application[]
}

export interface EscrowStats {
  activeEscrows: number
  totalVolume: string
  completedEscrows: number
}

export interface WalletState {
  address: string | null
  chainId: number | null
  isConnected: boolean
  balance: string
}

export interface Application {
  freelancerAddress: string
  coverLetter: string
  proposedTimeline: number
  appliedAt: number
  status: "pending" | "accepted" | "rejected"
}
