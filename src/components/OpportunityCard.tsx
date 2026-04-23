import Link from 'next/link'
import { MapPin, Clock, Briefcase, Wifi, Building2 } from 'lucide-react'
import type { Opportunity } from '@/lib/types'

interface Props {
  opportunity: Opportunity
  showApply?: boolean
}

const typeColors: Record<string, string> = {
  volunteer: 'bg-green-100 text-green-700',
  'micro-internship': 'bg-blue-100 text-blue-700',
  paid: 'bg-purple-100 text-purple-700',
}

const typeLabels: Record<string, string> = {
  volunteer: 'Volunteer',
  'micro-internship': 'Micro-Internship',
  paid: 'Paid Position',
}

const modeIcons: Record<string, React.ReactNode> = {
  remote: <Wifi size={14} />,
  hybrid: <Building2 size={14} />,
  onsite: <Building2 size={14} />,
  any: <Building2 size={14} />,
}

export default function OpportunityCard({ opportunity, showApply = true }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow hover:border-red-200 group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${typeColors[opportunity.type] || 'bg-gray-100 text-gray-600'}`}>
              {typeLabels[opportunity.type] || opportunity.type}
            </span>
            {opportunity.status === 'open' && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                Open
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors text-lg leading-snug">
            {opportunity.title}
          </h3>
          <p className="text-sm text-red-600 font-medium mt-1">{opportunity.company_name}</p>
        </div>
      </div>

      <p className="text-gray-600 text-sm line-clamp-2 mb-4">{opportunity.description}</p>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1">
          <MapPin size={13} />
          {opportunity.city}
        </span>
        <span className="flex items-center gap-1">
          {modeIcons[opportunity.work_mode]}
          <span className="capitalize">{opportunity.work_mode}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock size={13} />
          {opportunity.duration}
        </span>
        {opportunity.compensation && (
          <span className="flex items-center gap-1">
            <Briefcase size={13} />
            {opportunity.compensation}
          </span>
        )}
      </div>

      {opportunity.skills_required?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {opportunity.skills_required.slice(0, 4).map((skill) => (
            <span key={skill} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {skill}
            </span>
          ))}
          {opportunity.skills_required.length > 4 && (
            <span className="text-xs text-gray-400">+{opportunity.skills_required.length - 4} more</span>
          )}
        </div>
      )}

      {showApply && (
        <Link
          href={`/opportunities/${opportunity.id}`}
          className="block w-full text-center bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          View & Apply
        </Link>
      )}
    </div>
  )
}
