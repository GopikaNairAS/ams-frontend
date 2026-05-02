"use client";
 
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import TinderCard from "react-tinder-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check, X, RotateCcw, Save } from "lucide-react";
import { getAttendanceSessionById, type AttendanceSession } from "@/lib/api/attendance-session";
import { listUsers } from "@/lib/api/user";
import { createBulkAttendanceRecords, type AttendanceStatus } from "@/lib/api/attendance-record";
import type { User } from "@/lib/types/UserTypes";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useAttendance } from "@/app/context/AttendanceContext";
 
export const dynamic = "force-dynamic";
export const dynamicParams = true;
 
interface TinderCardAPI {
  swipe(dir?: string): Promise<void>;
  restoreCard(): Promise<void>;
}
 
// Slower, smoother spring — premium feel
const SMOOTH_SPRING = { type: "spring" as const, stiffness: 280, damping: 36, mass: 1 };
 
const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 300;
 
// One gradient mesh per student — deterministic from name
function getGradient(name: string) {
  const gradients = [
    "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    "linear-gradient(135deg, #0d1b2a 0%, #1b263b 40%, #415a77 100%)",
    "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 40%, #3a3a3c 100%)",
    "linear-gradient(135deg, #0a0908 0%, #22333b 40%, #4a5568 100%)",
    "linear-gradient(135deg, #10002b 0%, #240046 40%, #3c096c 100%)",
    "linear-gradient(135deg, #03071e 0%, #0d1b2a 40%, #1d3557 100%)",
  ];
  const idx = (name?.charCodeAt(0) || 0) % gradients.length;
  return gradients[idx];
}
 
function getAccent(name: string) {
  const accents = ["#6ee7b7", "#93c5fd", "#c4b5fd", "#fca5a5", "#fcd34d", "#86efac"];
  const idx = (name?.charCodeAt(0) || 0) % accents.length;
  return accents[idx];
}
 
function SwipeCard({
  student,
  isTop,
  stackIndex,
  cardRef,
  onSwipe,
  onCardLeftScreen,
  onManualSwipe,
}: {
  student: User;
  isTop: boolean;
  stackIndex: number;
  cardRef: React.RefObject<TinderCardAPI | null>;
  onSwipe: (dir: string, studentId: string) => void;
  onCardLeftScreen: (name: string) => void;
  onManualSwipe: (dir: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
 
  const greenOpacity = useTransform(x, [0, 70], [0, 1]);
  const redOpacity   = useTransform(x, [-70, 0], [1, 0]);
  const rotate       = useTransform(x, [-220, 220], [-14, 14]);
 
  // Next card slides in from the right — offset sideways, not downward
  const behindX      = stackIndex === 1 ? 28 : 0;
  const behindScale  = 1 - stackIndex * 0.05;
 
  const gradient = getGradient(student.name);
  const accent   = getAccent(student.name);
 
  const initials = `${student.first_name?.charAt(0) ?? ""}${student.last_name?.charAt(0) ?? ""}`.toUpperCase();
 
  const handleDragEnd = useCallback((_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const dist = info.offset.x;
    const vel  = info.velocity.x;
    if (dist > SWIPE_DISTANCE_THRESHOLD || vel > SWIPE_VELOCITY_THRESHOLD) {
      onManualSwipe("right");
    } else if (dist < -SWIPE_DISTANCE_THRESHOLD || vel < -SWIPE_VELOCITY_THRESHOLD) {
      onManualSwipe("left");
    } else {
      x.set(0);
    }
  }, [onManualSwipe, x]);
 
  return (
    <TinderCard
      ref={cardRef}
      key={student._id}
      className="absolute w-full h-full cursor-grab active:cursor-grabbing select-none"
      onSwipe={(dir: string) => onSwipe(dir, student._id!)}
      onCardLeftScreen={() => onCardLeftScreen(student.name)}
      preventSwipe={["up", "down"]}
      swipeRequirementType="position"
      swipeThreshold={SWIPE_DISTANCE_THRESHOLD}
    >
      <motion.div
        className="relative w-full h-full overflow-hidden"
        style={{
          x: isTop ? x : behindX,
          rotate: isTop ? rotate : 0,
          scale: isTop ? 1 : behindScale,
          zIndex: 100 - stackIndex,
          transformOrigin: "bottom center",
          borderRadius: 28,
          boxShadow: isTop
            ? "0 24px 64px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)"
            : "0 8px 24px rgba(0,0,0,0.18)",
        }}
        drag={isTop ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDrag={(_: any, info: any) => x.set(info.offset.x)}
        onDragEnd={handleDragEnd}
        animate={{ x: isTop ? undefined : behindX, scale: isTop ? 1 : behindScale }}
        transition={SMOOTH_SPRING}
      >
        {/* Deep gradient background */}
        <div
          className="absolute inset-0"
          style={{ background: gradient, borderRadius: 28 }}
        />
 
        {/* Noise texture overlay for depth */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            borderRadius: 28,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
 
        {/* Subtle radial glow from top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: 28,
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${accent}18 0%, transparent 70%)`,
          }}
        />
 
        {/* GREEN present overlay — frosted glass */}
        <motion.div
          className="absolute inset-0 flex items-start justify-end p-5 pointer-events-none"
          style={{
            opacity: greenOpacity,
            background: "linear-gradient(135deg, rgba(16,185,129,0.92) 0%, rgba(5,150,105,0.96) 100%)",
            borderRadius: 28,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="mt-6 px-4 py-2 rounded-xl"
            style={{
              border: "2px solid rgba(255,255,255,0.9)",
              transform: "rotate(-8deg)",
              color: "white",
              fontWeight: 900,
              fontSize: 20,
              letterSpacing: "0.12em",
              textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            PRESENT ✓
          </div>
        </motion.div>
 
        {/* RED absent overlay — frosted glass */}
        <motion.div
          className="absolute inset-0 flex items-start justify-start p-5 pointer-events-none"
          style={{
            opacity: redOpacity,
            background: "linear-gradient(135deg, rgba(239,68,68,0.92) 0%, rgba(185,28,28,0.96) 100%)",
            borderRadius: 28,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="mt-6 px-4 py-2 rounded-xl"
            style={{
              border: "2px solid rgba(255,255,255,0.9)",
              transform: "rotate(8deg)",
              color: "white",
              fontWeight: 900,
              fontSize: 20,
              letterSpacing: "0.12em",
              textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            ABSENT ✗
          </div>
        </motion.div>
 
        {/* Card content */}
        <div className="relative flex flex-col w-full h-full px-7 pt-10 pb-7" style={{ color: "white" }}>
 
          {/* Top row — swipe hints */}
          {isTop && (
            <div className="flex justify-between mb-6 opacity-40">
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#fca5a5" }}>← ABSENT</span>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#86efac" }}>PRESENT →</span>
            </div>
          )}
 
          {/* Giant initials — the premium centerpiece */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              {/* Glow ring */}
              <div
                className="absolute"
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${accent}30 0%, transparent 70%)`,
                  filter: "blur(16px)",
                }}
              />
              {/* Initials circle */}
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  border: `1.5px solid ${accent}55`,
                  background: `radial-gradient(circle at 35% 35%, ${accent}22, transparent 65%)`,
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 42,
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: "-0.02em",
                  textShadow: `0 0 32px ${accent}88`,
                }}
              >
                {initials}
              </div>
            </div>
          </div>
 
          {/* Student info — bottom section */}
          <div className="mt-6 space-y-1">
            {/* Thin divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)", marginBottom: 16 }} />
 
            <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.95)" }}>
              {student.name}
            </p>
 
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.06em" }}>
                {(student.profile as any)?.adm_number || "—"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                {(student.profile as any)?.department || ""}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </TinderCard>
  );
}
 
export default function SwipeAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
 
  const { initSession, setStudentStatus, setMultiple } = useAttendance();
 
  const [session, setSession]             = useState<AttendanceSession | null>(null);
  const [students, setStudents]           = useState<User[]>([]);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [markedRecords, setMarkedRecords] = useState<Array<{ studentId: string; status: AttendanceStatus }>>([]);
  const [currentIndex, setCurrentIndex]   = useState<number>(-1);
  const [lastSwipeDir, setLastSwipeDir]   = useState<string | null>(null);
  const [restoringCardId, setRestoringCardId] = useState<string | null>(null);
 
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const sessionData = await getAttendanceSessionById(sessionId);
        setSession(sessionData);
        const sessionBatchId = typeof sessionData.batch === "string" ? sessionData.batch : sessionData.batch?._id;
 
        let allStudents: User[] = [];
        let page = 1;
        let totalPages = 1;
        do {
          const usersResponse = await listUsers({ role: "student", batch: sessionBatchId, limit: 100, page });
          allStudents = [...allStudents, ...usersResponse.users];
          totalPages = usersResponse.pagination?.totalPages || 1;
          page++;
        } while (page <= totalPages);
 
        setStudents(allStudents);
        setCurrentIndex(allStudents.length - 1);
        initSession(sessionId);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load session or students.");
      } finally {
        setLoading(false);
      }
    };
    if (sessionId) loadData();
  }, [sessionId]);
 
  const childRefs = useMemo(
    () => Array(students.length).fill(0).map(() => React.createRef<TinderCardAPI>()),
    [students.length]
  );
 
  const canGoBack = currentIndex < students.length - 1;
  const canSwipe  = currentIndex >= 0;
 
  const swiped = useCallback((direction: string, studentId: string, index: number) => {
    const status: AttendanceStatus = direction === "right" ? "present" : "absent";
    setLastSwipeDir(direction);
    setStudentStatus(studentId, status);
    setMarkedRecords((prev: Array<{ studentId: string; status: AttendanceStatus }>) => {
      const existing = prev.filter((r: { studentId: string; status: AttendanceStatus }) => r.studentId !== studentId);
      return [...existing, { studentId, status }];
    });
    setCurrentIndex(index - 1);
  }, [setStudentStatus]);
 
  const outOfFrame = useCallback((_name: string, _idx: number) => {}, []);
 
  const swipe = async (dir: string) => {
    if (canSwipe && currentIndex < students.length) {
      await childRefs[currentIndex].current?.swipe(dir);
    }
  };
 
  const handleManualSwipe = useCallback((dir: "left" | "right") => {
    if (currentIndex >= 0 && currentIndex < students.length) {
      childRefs[currentIndex].current?.swipe(dir);
    }
  }, [childRefs, currentIndex, students.length]);
 
  const goBack = async () => {
    if (!canGoBack) return;
    const newIndex = currentIndex + 1;
    const restoredStudent = students[newIndex];
    setRestoringCardId(restoredStudent._id!);
    await childRefs[newIndex].current?.restoreCard();
    setCurrentIndex(newIndex);
    setMarkedRecords((prev: Array<{ studentId: string; status: AttendanceStatus }>) => {
      const newArray = [...prev];
      const removed = newArray.pop();
      if (removed) setStudentStatus(removed.studentId, undefined as any);
      return newArray;
    });
    setTimeout(() => setRestoringCardId(null), 700);
  };
 
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (!session) throw new Error("No session found");
      await createBulkAttendanceRecords({
        session: session._id,
        records: markedRecords.map((r: { studentId: string; status: AttendanceStatus }) => ({ student: r.studentId, status: r.status })),
      });
      setMultiple(markedRecords.map((r: { studentId: string; status: AttendanceStatus }) => ({ studentId: r.studentId, status: r.status })));
      toast.success("Attendance successfully marked!");
      router.push(`/dashboard/attendance/session/${sessionId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit attendance.");
    } finally {
      setSubmitting(false);
    }
  };
 
  const presentCount = markedRecords.filter((r: { studentId: string; status: AttendanceStatus }) => r.status === "present").length;
  const absentCount  = markedRecords.filter((r: { studentId: string; status: AttendanceStatus }) => r.status === "absent").length;
  const remaining    = students.length - presentCount - absentCount;
 
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-[440px] w-full max-w-sm rounded-[28px]" />
      </div>
    );
  }
 
  if (!session || students.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-bold mb-4">No Students Found</h2>
        <Button onClick={() => router.push(`/dashboard/attendance/session/${sessionId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }
 
  return (
    <div className="min-h-screen flex flex-col pt-8 pb-6 px-4 md:px-8 select-none">
 
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/attendance/session/${sessionId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Swipe Attendance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {session.subject.name} · {session.batch?.name || "N/A"}
          </p>
        </div>
      </div>
 
      {/* Stat pills */}
      <div className="flex justify-center gap-3 mb-8">
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981" }}>
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {presentCount} Present
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
          {absentCount} Absent
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground"
          style={{ background: "rgba(128,128,128,0.06)", border: "1px solid rgba(128,128,128,0.15)" }}>
          {remaining} Left
        </div>
      </div>
 
      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
 
        {/* Done state */}
        <AnimatePresence>
          {currentIndex === -1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={SMOOTH_SPRING}
              className="w-full"
            >
              <Card className="w-full text-center shadow-2xl border">
                <CardHeader>
                  <CardTitle className="text-2xl">All Done 🎉</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl p-5" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <p className="text-4xl font-black" style={{ color: "#10b981" }}>{presentCount}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">Present</p>
                    </div>
                    <div className="rounded-2xl p-5" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <p className="text-4xl font-black text-red-500">{absentCount}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-medium">Absent</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <Button className="w-full h-11" onClick={handleSubmit} disabled={submitting}>
                      {submitting ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Submit Attendance</>}
                    </Button>
                    <Button variant="outline" className="w-full h-11" onClick={goBack} disabled={submitting}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Review Last Card
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
 
        {/* Card Stack */}
        {currentIndex >= 0 && (
          <div className="relative w-full" style={{ height: 440 }}>
            {students.map((student, idx) => {
              if (idx > currentIndex) return null;
              const stackIndex = currentIndex - idx;
              if (stackIndex > 1) return null;
 
              const isTop = stackIndex === 0;
              const isRestoring = student._id === restoringCardId;
 
              return (
                <AnimatePresence key={student._id}>
                  {isRestoring ? (
                    // Flip-back from the swipe direction — slides in sideways
                    <motion.div
                      className="absolute w-full overflow-hidden"
                      style={{
                        height: "100%",
                        zIndex: 0,
                        borderRadius: 28,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      }}
                      initial={{
                        x: lastSwipeDir === "right" ? 340 : -340,
                        rotateY: lastSwipeDir === "right" ? 90 : -90,
                        scale: 0.9,
                        opacity: 0,
                      }}
                      animate={{ x: 28, rotateY: 0, scale: 0.95, opacity: 1 }}
                      transition={SMOOTH_SPRING}
                    >
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          background: getGradient(student.name),
                          borderRadius: 28,
                        }}
                      >
                        <span style={{ fontSize: 36, fontWeight: 700, color: getAccent(student.name), opacity: 0.6 }}>
                          {`${student.first_name?.charAt(0) ?? ""}${student.last_name?.charAt(0) ?? ""}`.toUpperCase()}
                        </span>
                      </div>
                    </motion.div>
                  ) : (
                    // Next card slides in from the right
                    <motion.div
                      key={`wrapper-${student._id}`}
                      className="absolute w-full"
                      style={{ height: "100%" }}
                      initial={stackIndex === 1 ? { opacity: 0, x: 60, scale: 0.9 } : false}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={SMOOTH_SPRING}
                    >
                      <SwipeCard
                        student={student}
                        isTop={isTop}
                        stackIndex={stackIndex}
                        cardRef={childRefs[idx]}
                        onSwipe={(dir) => swiped(dir, student._id!, idx)}
                        onCardLeftScreen={() => outOfFrame(student.name, idx)}
                        onManualSwipe={handleManualSwipe}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })}
          </div>
        )}
 
        {/* Action buttons */}
        {currentIndex >= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, ...SMOOTH_SPRING }}
            className="flex items-center justify-center gap-6 mt-8"
          >
            {/* Absent */}
            <motion.button
              whileTap={{ scale: 0.86 }}
              whileHover={{ scale: 1.07 }}
              onClick={() => swipe("left")}
              className="h-16 w-16 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1.5px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
                boxShadow: "0 4px 20px rgba(239,68,68,0.15)",
              }}
            >
              <X className="h-7 w-7" />
            </motion.button>
 
            {/* Undo */}
            <motion.button
              whileTap={{ scale: 0.86 }}
              whileHover={{ scale: 1.07 }}
              onClick={goBack}
              disabled={!canGoBack}
              className="h-11 w-11 rounded-full flex items-center justify-center disabled:opacity-25"
              style={{
                background: "rgba(128,128,128,0.07)",
                border: "1px solid rgba(128,128,128,0.2)",
                color: "var(--muted-foreground)",
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </motion.button>
 
            {/* Present */}
            <motion.button
              whileTap={{ scale: 0.86 }}
              whileHover={{ scale: 1.07 }}
              onClick={() => swipe("right")}
              className="h-16 w-16 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1.5px solid rgba(16,185,129,0.3)",
                color: "#10b981",
                boxShadow: "0 4px 20px rgba(16,185,129,0.15)",
              }}
            >
              <Check className="h-7 w-7" />
            </motion.button>
          </motion.div>
        )}
      </div>
 
      {/* Progress bar */}
      {currentIndex >= 0 && (
        <div className="mt-8 w-full max-w-sm mx-auto">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{students.length - 1 - currentIndex} marked</span>
            <span>{students.length} total</span>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(128,128,128,0.12)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #10b981, #6ee7b7)" }}
              initial={{ width: 0 }}
              animate={{ width: `${((students.length - 1 - currentIndex) / students.length) * 100}%` }}
              transition={SMOOTH_SPRING}
            />
          </div>
        </div>
      )}
    </div>
  );
}
 