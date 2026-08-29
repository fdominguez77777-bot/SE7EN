import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/project-status.enum';

export function assertDatesValid(opensAt?: Date | null, closesAt?: Date | null): void {
  if (opensAt && closesAt && closesAt <= opensAt) {
    throw new Error('closesAt must be after opensAt');
  }
}

export function isWithinBidWindow(project: Project, now = new Date()): boolean {
  if (project.status !== ProjectStatus.OPEN) {
    return false;
  }
  if (project.opensAt && now < project.opensAt) {
    return false;
  }
  if (project.closesAt && now > project.closesAt) {
    return false;
  }
  return true;
}

export function bidWindowMessage(project: Project, now = new Date()): string {
  if (project.status !== ProjectStatus.OPEN) {
    return 'Project is not open for bids';
  }
  if (project.opensAt && now < project.opensAt) {
    return 'Bidding has not opened yet';
  }
  if (project.closesAt && now > project.closesAt) {
    return 'The bid deadline has passed';
  }
  return 'Project is not open for bids';
}
