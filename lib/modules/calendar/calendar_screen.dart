import 'package:flutter/material.dart';

class CalendarScreen extends StatelessWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const events = [
      'Birthday Party',
      'Doctor Appointment',
      'Family Dinner',
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
