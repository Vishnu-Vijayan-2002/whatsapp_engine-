import React, { useState, useMemo } from 'react';
import type { Appointment } from '../types';
import './AppointmentCalendar.css';

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onSelectBooking: (appt: Appointment) => void;
  onScheduleForDate?: (dateStr: string) => void;
}

type CalendarView = 'MONTH' | 'WEEK' | 'DAY';

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  onSelectBooking,
  onScheduleForDate,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarView>('MONTH');

  // Format Helper: YYYY-MM-DD in local time
  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => formatDateKey(new Date()), []);

  // Quick lookup map: dateStr -> Appointment[]
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((appt) => {
      const dateKey = appt.date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(appt);
    });

    // Sort each day's appointments by time
    map.forEach((list) => {
      list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    });

    return map;
  }, [appointments]);

  // Navigation handlers
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'MONTH') {
        next.setMonth(next.getMonth() - 1);
      } else if (viewMode === 'WEEK') {
        next.setDate(next.getDate() - 7);
      } else {
        next.setDate(next.getDate() - 1);
      }
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'MONTH') {
        next.setMonth(next.getMonth() + 1);
      } else if (viewMode === 'WEEK') {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + 1);
      }
      return next;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header Title
  const headerTitle = useMemo(() => {
    if (viewMode === 'MONTH') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'WEEK') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const sameMonth = startOfWeek.getMonth() === endOfWeek.getMonth();
      if (sameMonth) {
        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
      }
      return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentDate, viewMode]);

  // Status Chip Class Helper
  const getStatusClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'confirmed') return 'status-confirmed';
    if (s === 'attended' || s === 'completed') return 'status-completed';
    if (s === 'cancelled' || s === 'no_show') return 'status-cancelled';
    return 'status-pending';
  };

  // Switch to Day view for a specific date
  const handleJumpToDay = (dateObj: Date) => {
    setCurrentDate(dateObj);
    setViewMode('DAY');
  };

  // --- RENDER MONTH VIEW ---
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayIndex = firstDayOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    interface DayCell {
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }

    const cells: DayCell[] = [];

    // Prev month padding days
    for (let i = startingDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const dateStr = formatDateKey(d);
      cells.push({
        date: d,
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = formatDateKey(d);
      cells.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding days to complete grid (multiples of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateStr = formatDateKey(d);
      cells.push({
        date: d,
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="appt-cal-month-grid">
        {/* Day Name Headers */}
        {weekDays.map((name) => (
          <div key={name} className="appt-cal-day-header">
            {name}
          </div>
        ))}

        {/* Cells */}
        {cells.map((cell) => {
          const dayAppts = appointmentsByDate.get(cell.dateStr) || [];
          const visibleAppts = dayAppts.slice(0, 3);
          const hiddenCount = dayAppts.length - visibleAppts.length;

          return (
            <div
              key={cell.dateStr}
              className={`appt-cal-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${cell.isToday ? 'is-today' : ''}`}
            >
              <div className="appt-cal-cell-header">
                <span
                  className="appt-cal-day-num"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleJumpToDay(cell.date)}
                  title="View this day"
                >
                  {cell.dayNumber}
                </span>

                {onScheduleForDate && (
                  <button
                    type="button"
                    className="appt-cal-quick-add"
                    title={`Schedule booking on ${cell.dateStr}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onScheduleForDate(cell.dateStr);
                    }}
                  >
                    +
                  </button>
                )}
              </div>

              <div className="appt-cal-events-list">
                {visibleAppts.map((appt) => (
                  <div
                    key={appt.id}
                    className={`appt-cal-chip ${getStatusClass(appt.status)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBooking(appt);
                    }}
                    title={`${appt.time} • ${appt.customer_name} (${appt.service_name || 'Consultation'}) - ${appt.status}`}
                  >
                    <span className="appt-cal-chip-time">{appt.time}</span>
                    <span className="appt-cal-chip-name">{appt.customer_name}</span>
                  </div>
                ))}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className="appt-cal-more-btn"
                    onClick={() => handleJumpToDay(cell.date)}
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- RENDER WEEK VIEW ---
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }

    return (
      <div className="appt-cal-week-container">
        {days.map((dayObj) => {
          const dateStr = formatDateKey(dayObj);
          const isToday = dateStr === todayStr;
          const dayAppts = appointmentsByDate.get(dateStr) || [];

          return (
            <div key={dateStr} className={`appt-cal-week-col ${isToday ? 'is-today' : ''}`}>
              <div className="appt-cal-week-col-header">
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {dayObj.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: isToday ? 'var(--primary)' : 'var(--text-main)',
                    marginTop: '2px',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleJumpToDay(dayObj)}
                >
                  {dayObj.getDate()}
                </div>
              </div>

              <div className="appt-cal-week-body">
                {dayAppts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    No bookings
                  </div>
                ) : (
                  dayAppts.map((appt) => (
                    <div
                      key={appt.id}
                      className={`appt-cal-chip ${getStatusClass(appt.status)}`}
                      style={{ padding: '6px 8px', whiteSpace: 'normal', flexDirection: 'column', alignItems: 'flex-start' }}
                      onClick={() => onSelectBooking(appt)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '11px', fontWeight: 800 }}>
                        <span>{appt.time}</span>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>{appt.status}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '12px', marginTop: '2px' }}>
                        {appt.customer_name}
                      </div>
                      <div style={{ fontSize: '10.5px', opacity: 0.85, marginTop: '1px' }}>
                        {appt.service_name || 'Consultation'}
                      </div>
                    </div>
                  ))
                )}

                {onScheduleForDate && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: '1px dashed var(--border-light)',
                      borderRadius: '6px',
                      padding: '6px',
                      color: 'var(--primary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: 'auto',
                    }}
                    onClick={() => onScheduleForDate(dateStr)}
                  >
                    + Book Slot
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- RENDER DAY VIEW ---
  const renderDayView = () => {
    const dateStr = formatDateKey(currentDate);
    const dayAppts = appointmentsByDate.get(dateStr) || [];

    const confirmedCount = dayAppts.filter((a) => a.status === 'CONFIRMED').length;
    const completedCount = dayAppts.filter((a) => a.status === 'ATTENDED' || a.status === 'COMPLETED').length;
    const cancelledCount = dayAppts.filter((a) => a.status === 'CANCELLED' || a.status === 'NO_SHOW').length;

    return (
      <div className="appt-cal-day-container">
        {/* Day Metric Summary */}
        <div className="appt-cal-day-summary-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(72, 128, 255, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 900,
              }}
            >
              {currentDate.getDate()}
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Total Scheduled Appointments: <strong>{dayAppts.length}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4880FF' }}></span>
              Confirmed ({confirmedCount})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>
              Completed ({completedCount})
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94A3B8' }}></span>
              Cancelled ({cancelledCount})
            </span>

            {onScheduleForDate && (
              <button
                type="button"
                className="btn-primary-action"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => onScheduleForDate(dateStr)}
              >
                + Schedule Slot
              </button>
            )}
          </div>
        </div>

        {/* Chronological List of Appointments */}
        {dayAppts.length === 0 ? (
          <div className="appt-cal-day-empty">
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗓</div>
            <strong style={{ fontSize: '15px', color: 'var(--text-main)', display: 'block' }}>
              No appointments scheduled for this date
            </strong>
            <p style={{ fontSize: '13px', margin: '6px 0 16px' }}>
              Click below to book an appointment slot on {dateStr}.
            </p>
            {onScheduleForDate && (
              <button
                type="button"
                className="btn-primary-action"
                onClick={() => onScheduleForDate(dateStr)}
              >
                + Book New Appointment
              </button>
            )}
          </div>
        ) : (
          <div className="appt-cal-day-list">
            {dayAppts.map((appt) => (
              <div
                key={appt.id}
                className="appt-cal-day-item"
                onClick={() => onSelectBooking(appt)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-light)',
                      fontWeight: 800,
                      fontSize: '13px',
                      color: 'var(--text-main)',
                      minWidth: '85px',
                      textAlign: 'center',
                    }}
                  >
                    ⏱ {appt.time}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>
                        {appt.customer_name}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: appt.booking_source === 'whatsapp_bot' ? 'rgba(0, 182, 155, 0.12)' : 'rgba(72, 128, 255, 0.12)',
                          color: appt.booking_source === 'whatsapp_bot' ? '#00B69B' : 'var(--primary)',
                          fontWeight: 700,
                        }}
                      >
                        {appt.booking_source === 'whatsapp_bot' ? '💬 WhatsApp Bot' : '👤 Admin Manual'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', marginTop: '4px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      <span>🎯 {appt.service_name || 'Standard Consultation'}</span>
                      {appt.customer_phone && <span>📞 {appt.customer_phone}</span>}
                      {appt.duration_minutes && <span>⏳ {appt.duration_minutes} mins</span>}
                    </div>

                    {appt.notes && (
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "{appt.notes}"
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className={`status-pill ${
                      appt.status === 'CONFIRMED'
                        ? 'active'
                        : appt.status === 'ATTENDED' || appt.status === 'COMPLETED'
                        ? 'active'
                        : 'inactive'
                    }`}
                    style={
                      appt.status === 'ATTENDED' || appt.status === 'COMPLETED'
                        ? { background: 'rgba(16, 185, 129, 0.14)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }
                        : undefined
                    }
                  >
                    {appt.status}
                  </span>

                  <button
                    type="button"
                    className="btn-secondary-action"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBooking(appt);
                    }}
                  >
                    Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="appt-calendar-container">
      {/* Calendar Toolbar */}
      <div className="appt-cal-toolbar">
        {/* Left Navigation: Prev, Today, Next */}
        <div className="appt-cal-nav-group">
          <button
            type="button"
            className="appt-cal-nav-btn"
            onClick={handlePrev}
            title="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            className="appt-cal-today-btn"
            onClick={handleToday}
          >
            Today
          </button>
          <button
            type="button"
            className="appt-cal-nav-btn"
            onClick={handleNext}
            title="Next"
          >
            ›
          </button>
        </div>

        {/* Center: Period Title */}
        <h3 className="appt-cal-title">{headerTitle}</h3>

        {/* Right: View Selector */}
        <div className="appt-cal-view-group">
          <button
            type="button"
            className={`appt-cal-view-btn ${viewMode === 'MONTH' ? 'active' : ''}`}
            onClick={() => setViewMode('MONTH')}
          >
            Month
          </button>
          <button
            type="button"
            className={`appt-cal-view-btn ${viewMode === 'WEEK' ? 'active' : ''}`}
            onClick={() => setViewMode('WEEK')}
          >
            Week
          </button>
          <button
            type="button"
            className={`appt-cal-view-btn ${viewMode === 'DAY' ? 'active' : ''}`}
            onClick={() => setViewMode('DAY')}
          >
            Day
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'MONTH' && renderMonthView()}
      {viewMode === 'WEEK' && renderWeekView()}
      {viewMode === 'DAY' && renderDayView()}
    </div>
  );
};

