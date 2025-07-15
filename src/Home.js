import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import multiMonthPlugin from '@fullcalendar/multimonth'

function Home() {
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