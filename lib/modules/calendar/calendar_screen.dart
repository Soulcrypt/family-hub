import 'package:flutter/material.dart';

/// Simple calendar module listing upcoming events.
class CalendarModule extends StatelessWidget {
  const CalendarModule({super.key});

  @override
  Widget build(BuildContext context) {
    const events = [
      'Doctor Appointment',
      'Parent-Teacher Meeting',
      'Dinner with Grandma',
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Calendar'),
      ),
      body: ListView.builder(
        itemCount: events.length,
        itemBuilder: (context, index) {
          return ListTile(
            leading: const Icon(Icons.event),
            title: Text(events[index]),
          );
        },
      ),
    );
  }
}
