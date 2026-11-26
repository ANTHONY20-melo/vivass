import type {
  ActivityStatus,
  BiopsychosocialDimension,
  ProjectStatus,
  VivassAxis,
} from '@vivass/shared'
import {
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  BIOPSYCHOSOCIAL_DIMENSIONS,
  DIMENSION_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  VIVASS_AXES,
  AXIS_LABELS,
} from '@vivass/shared'

export function AxisSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: VivassAxis
  onChange: (axis: VivassAxis) => void
}) {
  return (
    <select
      id={id}
      className="input"
      value={value}
      onChange={(event) => onChange(event.target.value as VivassAxis)}
    >
      {VIVASS_AXES.map((axis) => (
        <option key={axis} value={axis}>
          {AXIS_LABELS[axis]}
        </option>
      ))}
    </select>
  )
}

export function DimensionSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: BiopsychosocialDimension
  onChange: (dimension: BiopsychosocialDimension) => void
}) {
  return (
    <select
      id={id}
      className="input"
      value={value}
      onChange={(event) =>
        onChange(event.target.value as BiopsychosocialDimension)
      }
    >
      {BIOPSYCHOSOCIAL_DIMENSIONS.map((dimension) => (
        <option key={dimension} value={dimension}>
          {DIMENSION_LABELS[dimension]}
        </option>
      ))}
    </select>
  )
}

export function ProjectStatusSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: ProjectStatus
  onChange: (status: ProjectStatus) => void
}) {
  return (
    <select
      id={id}
      className="input"
      value={value}
      onChange={(event) => onChange(event.target.value as ProjectStatus)}
    >
      {PROJECT_STATUSES.map((status) => (
        <option key={status} value={status}>
          {PROJECT_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  )
}

export function ActivityStatusSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: ActivityStatus
  onChange: (status: ActivityStatus) => void
}) {
  return (
    <select
      id={id}
      className="input"
      value={value}
      onChange={(event) => onChange(event.target.value as ActivityStatus)}
    >
      {ACTIVITY_STATUSES.map((status) => (
        <option key={status} value={status}>
          {ACTIVITY_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  )
}
