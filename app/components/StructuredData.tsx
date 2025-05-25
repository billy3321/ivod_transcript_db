import { IVODDetail } from '@/types';
import { formatIVODTitle, formatCommitteeNames, formatVideoType } from '@/lib/utils';

interface StructuredDataProps {
  data: IVODDetail;
}

export default function StructuredData({ data }: StructuredDataProps) {
  const displayTitle = formatIVODTitle(data.title, data.meeting_name, data.speaker_name);
  const structuredData: any = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "GovernmentOrganization",
        "name": "中華民國立法院",
        "alternateName": "Legislative Yuan, Republic of China",
        "url": "https://www.ly.gov.tw",
        "address": {
          "@type": "PostalAddress",
          "addressCountry": "TW",
          "addressLocality": "台北市",
          "addressRegion": "台北市",
          "streetAddress": "中山南路1號",
          "postalCode": "100"
        },
        "telephone": "+886-2-2358-5858",
        "sameAs": [
          "https://zh.wikipedia.org/wiki/中華民國立法院",
          "https://www.facebook.com/LegislativeYuan"
        ]
      },
      {
        "@type": "Meeting",
        "name": displayTitle,
        "alternateName": data.title && data.meeting_name && data.title !== data.meeting_name ? data.meeting_name : undefined,
        "startDate": data.date,
        "organizer": {
          "@type": "GovernmentOrganization", 
          "name": "中華民國立法院"
        },
        "location": {
          "@type": "Place",
          "name": "立法院議場",
          "address": {
            "@type": "PostalAddress",
            "addressCountry": "TW",
            "addressLocality": "台北市",
            "streetAddress": "中山南路1號"
          }
        },
        "about": "立法院會議紀錄",
        "description": `${displayTitle}的完整會議紀錄與逐字稿${data.title && data.meeting_name && data.title !== data.meeting_name ? `（${data.meeting_name}）` : ''}`,
        "inLanguage": "zh-TW",
        "recordedIn": {
          "@type": "VideoObject",
          "name": `${displayTitle} - ${data.date}`,
          "description": `${displayTitle}會議影片與逐字稿記錄`,
          "uploadDate": data.date,
          "duration": data.video_length || "PT0M",
          "embedUrl": data.video_url,
          "contentUrl": data.ivod_url,
          "thumbnailUrl": "/ivod-thumbnail.jpg",
          "transcript": data.ai_transcript || data.ly_transcript,
          "inLanguage": "zh-TW",
          "creator": {
            "@type": "GovernmentOrganization",
            "name": "中華民國立法院"
          },
          "publisher": {
            "@type": "GovernmentOrganization", 
            "name": "中華民國立法院"
          }
        }
      },
      {
        "@type": "WebPage",
        "name": `${displayTitle} - IVOD 逐字稿`,
        "description": `${displayTitle}會議的完整逐字稿與影片記錄${data.title && data.meeting_name && data.title !== data.meeting_name ? `（${data.meeting_name}）` : ''}`,
        "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/ivod/${data.ivod_id}`,
        "mainEntity": {
          "@type": "Meeting",
          "name": displayTitle
        },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "IVOD 逐字稿檢索系統",
              "item": process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'
            },
            {
              "@type": "ListItem", 
              "position": 2,
              "name": displayTitle,
              "item": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/ivod/${data.ivod_id}`
            }
          ]
        },
        "inLanguage": "zh-TW",
        "isPartOf": {
          "@type": "WebSite",
          "name": "IVOD 逐字稿檢索系統",
          "url": process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'
        }
      }
    ]
  };

  // Add Person schema if speaker exists
  if (data.speaker_name) {
    structuredData["@graph"].push({
      "@type": "Person",
      "name": data.speaker_name,
      "jobTitle": "立法委員",
      "worksFor": {
        "@type": "GovernmentOrganization",
        "name": "中華民國立法院"
      },
      "nationality": {
        "@type": "Country",
        "name": "中華民國"
      }
    });
  }

  // Add Organization schema for committees if exists
  if (data.committee_names) {
    const formattedCommittees = formatCommitteeNames(data.committee_names);
    const committees = formattedCommittees !== 'N/A' ? formattedCommittees.split(',').map(name => name.trim()) : [];
    committees.forEach(committee => {
      structuredData["@graph"].push({
        "@type": "GovernmentOrganization",
        "name": `${committee}委員會`,
        "parentOrganization": {
          "@type": "GovernmentOrganization",
          "name": "中華民國立法院"
        }
      });
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
}