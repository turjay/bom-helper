export const SAMPLE_ASSEMBLIES_CSV = `assembly_uid,assembly,system
1001,Brake Discs,BR
1002,Calipers,BR
1003,Differential,DT
1004,Differential Mounts,DT
1005,A-Arms front lower,SU
1006,Accumulator Container,ET
1007,Front Hubs,WT
1008,Tires,WT
1009,Steering Rack,ST
1010,Frame / Frame Tubes,FR
1011,BSPD,LV
1012,Seats,MS
`;

export const SAMPLE_PARTS_CSV = `part_uid,assembly_uid,part_no,part,make_buy,quantity,comments,custom_id,delete,cost,material,process,mass,emissions,supplier,currency
2001,1001,P-BR-01,Front Left Brake Disc,make,1,Left side rotor disc,C-FL-01,0,45.50,Steel,CNC Milling,1.25,12.3,In-house,EUR
2002,1001,P-BR-02,Front Right Brake Disc,make,1,Right side rotor disc,C-FR-01,0,45.50,Steel,CNC Milling,1.25,12.3,In-house,EUR
2003,1002,P-BR-03,Left Caliper Assembly,buy,1,Four-piston caliper assembly,C-CAL-01,0,120.00,,,0.85,5.2,Brembo,USD
2004,1007,P-WT-01,Front Left Hub Assembly,make,1,Machined front hub assembly,C-HUB-01,0,85.00,Aluminium,CNC Milling,0.95,9.8,In-house,EUR
2005,1009,P-ST-01,Steering Pinion,make,1,Pinion gear for steering rack,C-PIN-01,0,32.00,Steel,Turning,0.30,3.4,In-house,EUR
`;

export const SAMPLE_SUBPARTS_CSV = `subpart_uid,part_uid,part_no,part,make_buy,quantity,comments,delete,cost,material,process,mass,emissions,supplier,currency
3001,2003,SP-BR-01,Caliper Body,make,1,Machined caliper housing,0,60.00,Aluminium,CNC Milling,0.50,4.1,In-house,EUR
3002,2003,SP-BR-02,Pistons,buy,4,Stainless steel pistons,0,15.00,Steel,Turning,0.08,0.2,Wilwood,USD
3003,2004,SP-WT-01,Hub Flange,make,1,Wheel interface flange,0,50.00,Aluminium,CNC Milling,0.60,6.2,In-house,EUR
3004,2004,SP-WT-02,Wheel Bearings,buy,2,Double row ball bearings,0,17.50,Steel,Assembly,0.15,1.5,SKF,USD
`;
