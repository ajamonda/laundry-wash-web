export const OPTION_GROUP_LABELS: Record<string, string> = {
  cleaning_method: '세탁 방법',
  additional_care: '추가 케어',
  repair: '수선',
  washing_notice: '세탁 유의사항',
  item_characteristics: '세탁물 특징',
  bag_characteristics: '가방 특징',
  material: '재질',
  size_band: '크기',
  fulfillment: '수령 방법',
  second_hand_pickup: '헌옷 수거',
};

export function optionGroupLabel(code: string): string {
  return OPTION_GROUP_LABELS[code] ?? code;
}

export const ROUTE_LABELS: Record<string, string> = {
  GENERAL_CLOTHES_CLEANING: '일반 의류 세탁',
  REPAIR_AND_CLEANING: '수선 후 세탁',
  PREMIUM_CLEANING: '프리미엄 세탁',
  OUTSOURCED_CLEANING: '외주 세탁',
  STANDARD_SHOES_CLEANING: '신발 세탁',
  QUICK_LAUNDRY: '퀵 세탁',
  SECOND_HAND_PROCESSING: '중고 처리',
};

export const STEP_LABELS: Record<string, string> = {
  WASHING: '세탁',
  AIR_DRYING: '건조',
  PRESSING: '다림질',
  INSPECTING: '검수',
  READY_TO_PACKAGE: '포장 준비',
  REPAIRING: '수선',
  REPAIR_INSPECTING: '수선 검수',
  PREMIUM_WASHING: '프리미엄 세탁',
  PREMIUM_DRYING: '프리미엄 건조',
  PREMIUM_PRESSING: '프리미엄 다림질',
  PREMIUM_INSPECTING: '프리미엄 검수',
  PREMIUM_REPAIR_INSPECTING: '프리미엄 수선 검수',
  RE_INSPECTION: '재검수',
  WAITING_FOR_VENDOR: '외주 대기',
  HAND_OVER_TO_VENDOR: '외주 전달',
  TAKE_OVER_FROM_VENDOR: '외주 회수',
  MACHINE_DRYING: '기계 건조',
  FINISHED: '완료',
  WAIT_CUSTOMER_DECISION: '고객 응답 대기',
};

export const ITEM_STATUS_LABELS: Record<string, string> = {
  INIT: '초기',
  PICK_UP: '수거됨',
  TAGGED: '태그 등록됨',
  SORTED: '경로 배정됨',
  PROCESSING: '처리 중',
  READY_TO_PACKAGE: '포장 대기',
  READY_FOR_DELIVERY: '배송 준비',
  DELIVERING: '배송 중',
  FINISHED: '완료',
};

export function routeLabel(code: string): string {
  return ROUTE_LABELS[code] ?? code;
}

export function stepLabel(type: string): string {
  return STEP_LABELS[type] ?? type;
}

export function itemStatusLabel(status: string): string {
  return ITEM_STATUS_LABELS[status] ?? status;
}
