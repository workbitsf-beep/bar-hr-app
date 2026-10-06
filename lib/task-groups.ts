/**
 * Una nota data a più persone è una riga per persona nel database: ognuno ha
 * la sua da confermare. Chi le gestisce, però, ne ha scritta una sola, e
 * vederla due volte di fila nel calendario e nelle Note sembrava un errore.
 *
 * Qui le copie nate insieme - stesso testo, stessa scadenza, stesso autore,
 * stesso istante di creazione - tornano una riga sola, che porta tutti i
 * suoi id. Chi riceve la nota vede solo la sua, e non cambia niente.
 */

type GroupableTask = {
  id: string;
  title: string;
  dueDate: Date;
  createdAt: Date;
  isUrgent: boolean;
  requiresConfirmation: boolean;
  assignedToAll: boolean;
  createdBy: { id: string };
};

export type TaskGroup<T extends GroupableTask> = {
  /** The first copy: title, date and flags are the same on all of them. */
  lead: T;
  members: T[];
  /** Every id, comma-separated, as the actions read it. */
  ids: string;
};

export function groupSharedTasks<T extends GroupableTask>(tasks: T[]): TaskGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const task of tasks) {
    const key = task.assignedToAll
      ? `all|${task.id}`
      : [
          task.title,
          task.dueDate.getTime(),
          task.createdBy.id,
          task.createdAt.getTime(),
          task.isUrgent ? 1 : 0,
          task.requiresConfirmation ? 1 : 0,
        ].join("|");
    const members = groups.get(key);

    if (members) {
      members.push(task);
    } else {
      groups.set(key, [task]);
    }
  }

  return Array.from(groups.values()).map((members) => ({
    lead: members[0],
    members,
    ids: members.map((member) => member.id).join(","),
  }));
}

/** "Sergio Tipa ✓, Work Wo": who has it, and who has already done it. */
export function describeAssignees(
  members: Array<{ status: string; assignedTo: { firstName: string; lastName: string } | null }>
) {
  return members
    .map((member) => {
      const name = member.assignedTo
        ? `${member.assignedTo.firstName} ${member.assignedTo.lastName}`.trim()
        : "non assegnata";
      return members.length > 1 && member.status === "DONE" ? `${name} ✓` : name;
    })
    .join(", ");
}
