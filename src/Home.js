import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import multiMonthPlugin from '@fullcalendar/multimonth'
import React, { useEffect, useState } from 'react';

async function exchangeAccessToken(refreshToken) {
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token'
      })
    });
    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      console.log('Refreshed access token:', data.access_token);
    }
  } catch (error) {
    console.error('Error refreshing access token:', error);
  }
}

async function fetchCalendarEvents(accessToken, calendarId, retryCount = 0) {
  const maxRetries = 1;
  let allEvents = [];
  let nextPageToken = null;
  
  do {
    const eventsEndpoint = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?maxResults=2500${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    
    try {
      const response = await fetch(eventsEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });
      
      if (response.status === 401 && retryCount < maxRetries) {
        // アクセストークンが期限切れの場合
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          await exchangeAccessToken(refreshToken);
          const newAccessToken = localStorage.getItem('access_token');
          console.log('Retrying with new access token for calendar:', calendarId);
          if (newAccessToken) {
            // 新しいアクセストークンで再帰呼び出し
            return await fetchCalendarEvents(newAccessToken, calendarId, retryCount + 1);
          }
        }
        throw new Error('Token refresh failed');
      }
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      allEvents = allEvents.concat(data.items || []);
      nextPageToken = data.nextPageToken;
      
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      break;
    }
  } while (nextPageToken);
  
  console.log(`Fetched ${allEvents.length} events for calendar ${calendarId}`);
  localStorage.setItem('calendar_events', JSON.stringify(allEvents));
  return allEvents;
}

function Home() {
  const [events, setEvents] = useState(() => {
    const savedEvents = localStorage.getItem('formatted_events');
    return savedEvents ? JSON.parse(savedEvents) : [];
  });
  useEffect(() => {
    const loadEvents = async () => {
      const accessToken = localStorage.getItem('access_token');
      const selectedCalendarsString = localStorage.getItem('selected_calendars');
      
      if (!accessToken || !selectedCalendarsString) {
        return;
      }

      const selectedCalendars = JSON.parse(selectedCalendarsString);
      const allEvents = [];

      // 選択されたカレンダーごとに予定を取得
      for (const calendarId of selectedCalendars) {
        const calendarEvents = await fetchCalendarEvents(accessToken, calendarId);
        
        // FullCalendar用の形式に変換
        const formattedEvents = calendarEvents.map(event => ({
          id: event.id,
          title: event.summary || '(タイトルなし)',
          start: event.start.dateTime || event.start.date,
          end: event.end.dateTime || event.end.date,
          allDay: !event.start.dateTime, // dateTimeがない場合は終日イベント
        }));
        
        allEvents.push(...formattedEvents);
      }
      console.log('Fetched events:', allEvents);
      localStorage.setItem('formatted_events', JSON.stringify(allEvents));
      setEvents(allEvents);
    };

    loadEvents();
  }, []);

  return (
    <>
      <FullCalendar
        locale='ja'
        allDayText="終日"
        height="auto"
        plugins={[timeGridPlugin,dayGridPlugin,interactionPlugin,multiMonthPlugin]}
        initialView="dayGridMonth"
        slotDuration="00:30:00"
        selectable={true}
        events={events}
        businessHours={{
            daysOfWeek:[1,2,3,4,5],
            startTime:"00:00",
            endTime:"24:00"
        }}
        weekends={true}
        titleFormat={{
            year:"numeric",
            month:"short"
        }}
        headerToolbar={{
            start:"title",
            center:"prev,next,today",
            end:"multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay"
        }}
        views={{
          multiMonthYear: {
            type: 'multiMonth',
            duration: { years: 1 },
            buttonText: '年'
          },
          dayGridMonth: {
            type: 'dayGrid',
            duration: { month: 1 },
            buttonText: '月'
          },
          timeGridWeek: {
            type: 'timeGrid',
            duration: { weeks: 1 },
            buttonText: '週'
          },
          timeGridDay: {
            type: 'timeGrid',
            duration: { days: 1 },
            buttonText: '日'
          }
        }}
      />
    </>
  );
}

export default Home;