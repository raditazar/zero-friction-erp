"use client";

import React, { useState, useEffect } from "react";
import {
  AppDialog,
  AppDialogTrigger,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogBody,
  AppDialogFooter,
  AppDialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

export interface SecretRevealDialogProps {
  /** The secret text to reveal */
  secret: string;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Optional trigger element */
  trigger?: React.ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Controlled open state handler */
  onOpenChange?: (open: boolean) => void;
}

export function SecretRevealDialog({
  secret,
  title = "View Secret",
  description,
  trigger,
  open,
  onOpenChange,
}: SecretRevealDialogProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRevealed && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRevealed(false);
      setTimeLeft(30);
    }
    return () => clearInterval(timer);
  }, [isRevealed, timeLeft]);

  // Reset state when modal is closed
  useEffect(() => {
    if (open === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRevealed(false);
      setTimeLeft(30);
      setCopied(false);
    }
  }, [open]);

  const handleReveal = () => {
    if (!isRevealed) {
      setIsRevealed(true);
      setTimeLeft(30);
    } else {
      setIsRevealed(false);
      setTimeLeft(30);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const internalOnOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setIsRevealed(false);
      setTimeLeft(30);
      setCopied(false);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <AppDialog open={open} onOpenChange={internalOnOpenChange}>
      {trigger && <AppDialogTrigger asChild>{trigger}</AppDialogTrigger>}
      <AppDialogContent size="md">
        <AppDialogHeader>
          <AppDialogTitle>{title}</AppDialogTitle>
          {description && <AppDialogDescription>{description}</AppDialogDescription>}
        </AppDialogHeader>
        <AppDialogBody className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-md border">
              <div className="font-mono text-sm break-all">
                {isRevealed ? secret : "••••••••••••••••••••••••••••••••"}
              </div>
              <div className="flex items-center space-x-1 shrink-0 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleReveal}
                  title={isRevealed ? "Hide secret" : "Reveal secret"}
                >
                  {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  title="Copy secret"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            {isRevealed && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Secret will be hidden in</span>
                  <span>{timeLeft}s</span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(timeLeft / 30) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </AppDialogBody>
        <AppDialogFooter>
          <AppDialogClose asChild>
            <Button variant="outline">Close</Button>
          </AppDialogClose>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
