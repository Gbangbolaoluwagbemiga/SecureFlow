"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { AIMilestoneWriter } from "@/components/ai-milestone-writer";

interface Milestone {
  description: string;
  amount: string;
}

interface MilestonesStepProps {
  milestones: Milestone[];
  onUpdate: (milestones: Milestone[]) => void;
  showAIWriter: boolean;
  onToggleAIWriter: (show: boolean) => void;
  currentMilestoneIndex: number | null;
  onSetCurrentMilestoneIndex: (index: number | null) => void;
}

export function MilestonesStep({
  milestones,
  onUpdate,
  showAIWriter,
  onToggleAIWriter,
  currentMilestoneIndex,
  onSetCurrentMilestoneIndex,
}: MilestonesStepProps) {
  const addMilestone = () => {
    onUpdate([...milestones, { description: "", amount: "" }]);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      onUpdate(milestones.filter((_, i) => i !== index));
    }
  };

  const updateMilestone = (
    index: number,
    field: keyof Milestone,
    value: string,
  ) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate(updated);
  };

  const handleAIWriterResult = (result: Milestone[]) => {
    onUpdate(result);
    onToggleAIWriter(false);
    onSetCurrentMilestoneIndex(null);
  };

  return (
    <Card className="glass border-primary/20 p-6">
      <CardHeader>
        <CardTitle>Milestones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAIWriter && (
          <AIMilestoneWriter
            onResult={handleAIWriterResult}
            onClose={() => {
              onToggleAIWriter(false);
              onSetCurrentMilestoneIndex(null);
            }}
            currentMilestoneIndex={currentMilestoneIndex}
            existingMilestones={milestones}
          />
        )}

        {milestones.map((milestone, index) => (
          <div key={index} className="border border-border/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Milestone {index + 1}</h4>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onSetCurrentMilestoneIndex(index);
                    onToggleAIWriter(true);
                  }}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  AI Writer
                </Button>
                {milestones.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeMilestone(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor={`milestone-${index}-description`}>
                  Description *
                </Label>
                <Textarea
                  id={`milestone-${index}-description`}
                  value={milestone.description}
                  onChange={(e) =>
                    updateMilestone(index, "description", e.target.value)
                  }
                  placeholder="Describe what needs to be delivered..."
                  className="min-h-[80px]"
                  required
                  minLength={10}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 10 characters required
                </p>
              </div>

              <div>
                <Label htmlFor={`milestone-${index}-amount`}>
                  Amount (tokens) *
                </Label>
                <Input
                  id={`milestone-${index}-amount`}
                  type="number"
                  value={milestone.amount}
                  onChange={(e) =>
                    updateMilestone(index, "amount", e.target.value)
                  }
                  placeholder="e.g., 500"
                  min="0.01"
                  step="0.01"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 0.01 tokens required
                </p>
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addMilestone}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Milestone
        </Button>
      </CardContent>
    </Card>
  );
}
