export interface Facility {
    id: string;
    name: string;
}

// Danh sách các cơ sở được cấu hình trong hệ thống
export const facilities: Facility[] = [
    {
        id: 'facility_1',
        name: 'Vinfast Kim Sơn Long Bình'
    },
    {
        id: 'facility_2',
        name: 'Vinfast Kim Sơn Tân Hiệp'
    },
    {
        id: 'facility_3',
        name: 'Vinfast Kim Sơn Long Thành'
    },
    {
        id: 'facility_4',
        name: 'Vinfast Kim Sơn Long Khánh'
    }
];

export const getFacilityById = (id: string): Facility | undefined => {
    return facilities.find(f => f.id === id);
};

// Trả về cơ sở mặc định ban đầu nếu người dùng chưa chọn
export const getDefaultFacility = (): Facility => {
    return facilities[0];
};
