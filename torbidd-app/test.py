base_url = 'http://process3.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml'

myData = []

def e_GP(dept_ids: list):
    anounce_types = ['W0', 'W2', 'B0', 'D0', 'D1', 'D2', 'P0', 'W1', '15']

    for anounce_type in anounce_types:
        for dept_id in (i for i in dept_ids if i not in ('')):
            fetchData(dept_id, anounce_type)

    from json import dumps
    return dumps(myData, ensure_ascii=False, indent=4)

def fetchData(dept_id, anounce_type):
    from urllib.request import urlopen
    from urllib.error import URLError, HTTPError
    import xml.etree.ElementTree as ET

    try:
        url = f'{base_url}?deptId={dept_id}&anounceType={anounce_type}'
        res = urlopen(url)
        tree = ET.parse(source=res, parser=ET.XMLParser(encoding='cp874')).getroot()
        list_data = {}
        for item in tree.findall('./channel/item'):
            list_data = {rss.tag: rss.text for rss in item if rss.tag not in ('guid')}
            list_data['anounceType'] = anounce_type
            list_data['egpid'] = dept_id
            myData.append(list_data)
    except (URLError, HTTPError, ConnectionError, ET.ParseError) as err:
        print(f'Error fetching data for dept_id {dept_id} and anounceType {anounce_type} : {err}')
        
# fetchData('00000', 'egpid')
# print(myData)

print(e_GP(['egpid']))