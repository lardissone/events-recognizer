"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompletion } from "ai/react";
import { useToast } from "@/hooks/use-toast";

type Event = {
  id: string;
  title: string;
  date: string;
  time: string;
  recurrence?: string;
  alarm?: number;
};

const MAX_REQUESTS_PER_MINUTE = 8;
const MAX_TEXT_LENGTH = 500;
const COOLDOWN_PERIOD = 60000; // 1 minute in milliseconds

export default function EventRecognizer() {
  const [text, setText] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [checkedEvents, setCheckedEvents] = useState<Set<string>>(new Set());
  const [requestCount, setRequestCount] = useState(0);
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const { toast } = useToast();

  const { complete, isLoading } = useCompletion({
    api: "/api/parse-events",
  });

  useEffect(() => {
    setCheckedEvents(new Set(events.map((event) => event.id)));
  }, [events]);

  const handleSubmit = async () => {
    const currentTime = Date.now();

    if (text.length > MAX_TEXT_LENGTH) {
      toast({
        title: "Text too long",
        description: `Please limit your input to ${MAX_TEXT_LENGTH} characters.`,
        variant: "destructive",
      });
      return;
    }

    if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
      if (currentTime - lastRequestTime < COOLDOWN_PERIOD) {
        toast({
          title: "Rate limit exceeded",
          description: "Please wait before making more requests.",
          variant: "destructive",
        });
        return;
      } else {
        // Reset the request count after the cooldown period
        setRequestCount(0);
      }
    }

    try {
      const result = await complete(text);
      if (result) {
        const parsedEvents = JSON.parse(result) as Omit<Event, "id">[];
        const eventsWithIds = parsedEvents.map((event) => ({
          ...event,
          id: Math.random().toString(36).substr(2, 9),
        }));
        setEvents(eventsWithIds);
      } else {
        console.error("Error: result is undefined or null");
      }
      // Update request count and last request time
      setRequestCount((prevCount) => prevCount + 1);
      setLastRequestTime(currentTime);
    } catch (error) {
      console.error("Error parsing events:", error);
      toast({
        title: "Error",
        description: "Failed to parse events. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCheckboxChange = (id: string) => {
    setCheckedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const generateICS = (events: Event[]): string => {
    let icsContent =
      "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//hacksw/handcal//NONSGML v1.0//EN\n";
    events.forEach((event) => {
      if (checkedEvents.has(event.id)) {
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `SUMMARY:${event.title}\n`;
        icsContent += `DTSTART:${event.date.replace(
          /-/g,
          ""
        )}T${event.time.replace(/:/g, "")}00\n`;
        if (event.recurrence) {
          icsContent += `RRULE:${event.recurrence}\n`;
        }
        if (event.alarm !== undefined) {
          icsContent += "BEGIN:VALARM\n";
          icsContent += "ACTION:DISPLAY\n";
          icsContent += `TRIGGER:-PT${event.alarm}M\n`;
          icsContent += "END:VALARM\n";
        }
        icsContent += "END:VEVENT\n";
      }
    });
    icsContent += "END:VCALENDAR";
    return icsContent;
  };

  const downloadICS = () => {
    const icsContent = generateICS(events);
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "events.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground py-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold mx-2 sm:mx-3 xs:mx-5">
            Event Recognizer
          </h1>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Recognize and Download Events</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Enter your events in natural language. Our AI will try to recognize them, including recurring events and alarms."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="mb-4 w-full resize-none"
            />
            <Button
              onClick={handleSubmit}
              className="w-full mb-4"
              disabled={isLoading}
            >
              {isLoading ? "Recognizing Events..." : "Recognize Events"}
            </Button>
            {events.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  Recognized Events:
                </h2>
                <ul className="space-y-2">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={event.id}
                        checked={checkedEvents.has(event.id)}
                        onCheckedChange={() => handleCheckboxChange(event.id)}
                        className="mt-1"
                      />
                      <label
                        htmlFor={event.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <div>
                          <strong>{event.title}</strong> on{" "}
                          <strong>{event.date}</strong> at{" "}
                          <strong>{event.time}</strong>
                        </div>
                        {event.recurrence && (
                          <div className="text-xs text-muted-foreground">
                            <strong>Recurs:</strong> {event.recurrence}
                          </div>
                        )}
                        {event.alarm !== undefined && (
                          <div className="text-xs text-muted-foreground">
                            <strong>Alarm:</strong> {event.alarm} minutes before
                          </div>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {events.length > 0 && (
              <Button
                onClick={downloadICS}
                className="w-full"
                disabled={checkedEvents.size === 0}
              >
                Download ICS File ({checkedEvents.size} events)
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>

      <footer className="bg-gray-100 py-4 text-center">
        <p className="text-sm text-gray-600">
          Made with <span className="text-red-500">❤</span> by{" "}
          <a href="https://leandroardissone.com/">Leandro Ardissone</a> -{" "}
          <a href="https://github.com/lardissone/events-recognizer">Source</a>
        </p>
      </footer>
    </div>
  );
}
