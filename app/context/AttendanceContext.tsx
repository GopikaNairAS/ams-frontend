"use client";
 
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { AttendanceStatus } from "@/lib/api/attendance-record";
 
export type AttendanceMap = Record<string, AttendanceStatus>;
 
interface AttendanceContextValue {
  attendanceMap: AttendanceMap;
  setStudentStatus: (studentId: string, status: AttendanceStatus) => void;
  setMultiple: (records: { studentId: string; status: AttendanceStatus }[]) => void;
  resetSession: () => void;
  sessionId: string | null;
  initSession: (sessionId: string, serverRecords?: AttendanceMap) => void;
}
 
const AttendanceContext = createContext<AttendanceContextValue | null>(null);
 
const STORAGE_PREFIX = "attendance_session_";
 
export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const sessionIdRef = useRef<string | null>(null);
 
  useEffect(() => {
    if (typeof window === "undefined") return;
    broadcastRef.current = new BroadcastChannel("attendance_sync");
    broadcastRef.current.onmessage = (event) => {
      if (event.data?.type === "ATTENDANCE_UPDATE" && event.data.sessionId === sessionIdRef.current) {
        setAttendanceMap(event.data.map);
      }
    };
    return () => broadcastRef.current?.close();
  }, []);
 
  const persist = useCallback((sid: string, map: AttendanceMap) => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${sid}`, JSON.stringify(map));
      broadcastRef.current?.postMessage({ type: "ATTENDANCE_UPDATE", sessionId: sid, map });
    } catch {}
  }, []);
 
  const initSession = useCallback((sid: string, serverRecords?: AttendanceMap) => {
    setTimeout(() => {
      sessionIdRef.current = sid;
      setSessionId(sid);
 
      if (serverRecords && Object.keys(serverRecords).length > 0) {
        setAttendanceMap(serverRecords);
        persist(sid, serverRecords);
        return;
      }
 
      try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${sid}`);
        if (stored) {
          setAttendanceMap(JSON.parse(stored));
          return;
        }
      } catch {}
 
      setAttendanceMap({});
    }, 0);
  }, [persist]);
 
  const setStudentStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setTimeout(() => {
      setAttendanceMap((prev) => {
        const next = { ...prev, [studentId]: status };
        if (sessionIdRef.current) persist(sessionIdRef.current, next);
        return next;
      });
    }, 0);
  }, [persist]);
 
  const setMultiple = useCallback((records: { studentId: string; status: AttendanceStatus }[]) => {
    setTimeout(() => {
      setAttendanceMap((prev) => {
        const next = { ...prev };
        records.forEach(({ studentId, status }) => { next[studentId] = status; });
        if (sessionIdRef.current) persist(sessionIdRef.current, next);
        return next;
      });
    }, 0);
  }, [persist]);
 
  const resetSession = useCallback(() => {
    if (sessionIdRef.current) {
      localStorage.removeItem(`${STORAGE_PREFIX}${sessionIdRef.current}`);
    }
    setAttendanceMap({});
  }, []);
 
  return (
    <AttendanceContext.Provider value={{ attendanceMap, setStudentStatus, setMultiple, resetSession, sessionId, initSession }}>
      {children}
    </AttendanceContext.Provider>
  );
}
 
export function useAttendance() {
  const ctx = useContext(AttendanceContext);
  if (!ctx) throw new Error("useAttendance must be used inside <AttendanceProvider>");
  return ctx;
}