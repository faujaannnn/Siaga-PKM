<?php

if (!defined('BASEPATH'))
    exit('No direct script access allowed');

class Baseweb_model extends CI_Model
{
    #Get Data
    function getTotal()
    {
        return $this->db->get('statistik')->num_rows();
    }

    function getTahunSekarang($tahun)
    {
        $this->db->where('tahun', $tahun);
        return $this->db->get('statistik')->num_rows();
    }

    function getBulanSekarang($tahun, $bulan)
    {
        $this->db->where('tahun', $tahun);
        $this->db->like('bulan', $bulan);
        return $this->db->get('statistik')->num_rows();
    }
    function getHariSekarang($tahun, $bulan, $hari)
    {
        $this->db->where('tahun', $tahun);
        $this->db->like('bulan', $bulan);
        $this->db->like('hari', $hari);
        return $this->db->get('statistik')->num_rows();
    }
    function getPengumuman()
    {
        $this->db->limit(5);
        return $this->db->get('pengumuman')->result();
    }

    function getBerita()
    {
        $this->db->limit(5);
        return $this->db->get('berita')->result();
    }

    function getUsername($id)
    {
        $this->db->where('username', $id);
        return $this->db->get('user_literasi')->num_rows();
    }

    function AmbilUser($id)
    {
        $this->db->where('username', $id);
        return $this->db->get('user_literasi');
    }
    function AmbilAdmin($id)
    {
        $this->db->where('username', $id);
        return $this->db->get('admin');
    }

    function getAllAdmin()
    {
        return $this->db->get('admin');
    }

    function DataBannerUtama()
    {
        $this->db->where('kategori_banner', 0);
        return $this->db->get('banner')->result();
    }

    function DataBannerFooter()
    {
        $this->db->where('kategori_banner', 1);
        return $this->db->get('banner')->result();
    }

    function getAturan()
    {
        return $this->db->get('peraturan')->result();
    }

    function getMateri()
    {
        return $this->db->get('materi')->result();
    }

    function getVideo()
    {
        return $this->db->get('video')->result();
    }

    function DataAturan($id)
    {
        $this->db->where('id_peraturan', $id);
        return $this->db->get('peraturan')->row_array();
    }

    function DataMateri($id)
    {
        $this->db->where('id_materi', $id);
        return $this->db->get('materi')->row_array();
    }

    function DataVideo($id)
    {
        $this->db->where('id_video', $id);
        return $this->db->get('video')->row_array();
    }

    function getAllBerita()
    {
        return $this->db->get('berita')->result();
    }

    function getAllPengumuman()
    {
        return $this->db->get('pengumuman')->result();
    }

    function AmbilBerita($id)
    {
        $this->db->where('id', $id);
        return $this->db->get('berita')->row_array();
    }

    function AmbilPengumuman($id)
    {
        $this->db->where('id', $id);
        return $this->db->get('pengumuman')->row_array();
    }

    function AmbilTipsBencana($id)
    {
        $this->db->where('id', $id);
        return $this->db->get('tips_bencana')->row_array();
    }

    function AmbilInfoPelatihan($id)
    {
        $this->db->where('id', $id);
        return $this->db->get('info_pelatihan')->row_array();
    }

    function total_rows($q = NULL)
    {
        $this->db->like('id', $q);

        $this->db->from('berita');
        return $this->db->count_all_results();
    }

    function get_limit_data($limit, $start = 0, $q = NULL)
    {
        $this->db->order_by('id', 'DESC');
        $this->db->like('id', $q);

        $this->db->limit($limit, $start);
        return $this->db->get('berita')->result();
    }

    function getBeritaTerkini()
    {
        $this->db->order_by('id', 'DESC');
        $this->db->limit(4);
        return $this->db->get('berita')->result();
    }

    function total_rows_pengumuman($q = NULL)
    {
        $this->db->like('id', $q);

        $this->db->from('pengumuman');
        return $this->db->count_all_results();
    }

    function get_limit_data_pengumuman($limit, $start = 0, $q = NULL)
    {
        $this->db->order_by('id', 'DESC');
        $this->db->like('id', $q);

        $this->db->limit($limit, $start);
        return $this->db->get('pengumuman')->result();
    }

    function getPengumumanTerbaru()
    {
        $this->db->order_by('id', 'DESC');
        $this->db->limit(3);
        return $this->db->get('pengumuman')->result();
    }

    function total_rows_tips_siaga($q = NULL)
    {
        $this->db->like('id', $q);

        $this->db->from('tips_bencana');
        return $this->db->count_all_results();
    }

    function get_limit_data_tips_siaga($limit, $start = 0, $q = NULL)
    {
        $this->db->order_by('id', 'DESC');
        $this->db->like('id', $q);

        $this->db->limit($limit, $start);
        return $this->db->get('tips_bencana')->result();
    }

    function total_rows_info_pelatihan($q = NULL)
    {
        $this->db->like('id', $q);

        $this->db->from('info_pelatihan');
        return $this->db->count_all_results();
    }

    function get_limit_data_info_pelatihan($limit, $start = 0, $q = NULL)
    {
        $this->db->order_by('id', 'DESC');
        $this->db->like('id', $q);

        $this->db->limit($limit, $start);
        return $this->db->get('info_pelatihan')->result();
    }

    function getAllTipsBencana()
    {
        return $this->db->get('tips_bencana')->result();
    }

    function getAllInfoPelatihan()
    {
        return $this->db->get('info_pelatihan')->result();
    }

    function GetAllBanner()
    {
        $this->db->order_by('id_banner', 'DESC');
        return $this->db->get('banner');
    }

    function GetBannerUtama()
    {
        $this->db->where('log_banner', 1);
        return $this->db->get('banner');
    }

    function GetBannerKedua()
    {
        $this->db->where('log_banner', 0);
        $this->db->order_by('id_banner', 'DESC');
        $this->db->limit(4);
        return $this->db->get('banner');
    }

    function GetDataBanner($id)
    {
        $this->db->where('id_banner', $id);
        return $this->db->get('banner')->row_array();
    }

    function getProfil($id)
    {
        $this->db->where('id', $id);
        return $this->db->get('profil')->row_array();
    }

    function getGaleri()
    {
        $this->db->like('log', 0);
        $this->db->order_by('id_galeri', 'DESC');
        $this->db->limit(6);
        return $this->db->get('galeri');
    }

    function getAllGaleri()
    {
        $this->db->order_by('id_galeri', 'DESC');
        return $this->db->get('galeri');
    }

    function get_kabkota($id)
    {
        $this->db->where('kode_provinsi', $id);
        return $this->db->get('kabkota')->result();
    }

    function get_kecamatan($id)
    {
        $this->db->where('kode_kabkota', $id);
        return $this->db->get('kecamatan')->result();
    }

    function getKelurhanDesa($id)
    {
        $this->db->where('kode_kecamatan', $id);
        return $this->db->get('desa_kelurahan')->result();
    }

    #Post Data
    function PostUser($data)
    {
        $this->db->insert('user_literasi', $data);
    }
    function PostAdmin($data)
    {
        $this->db->insert('admin', $data);
    }

    function PostBannerUtama($data)
    {
        $this->db->insert('banner', $data);
    }

    function PostKontrolAturan($data)
    {
        $this->db->insert('kontrol_literasi_aturan', $data);
    }
    function PostKontrolMateri($data)
    {
        $this->db->insert('kontrol_literasi_materi', $data);
    }
    function PostKontrolVideo($data)
    {
        $this->db->insert('kontrol_literasi_video', $data);
    }

    function PostAturan($data)
    {
        $this->db->insert('peraturan', $data);
    }
    function PostMateri($data)
    {
        $this->db->insert('materi', $data);
    }
    function PostVideo($data)
    {
        $this->db->insert('video', $data);
    }

    function PostBerita($data)
    {
        $this->db->insert('berita', $data);
    }

    function PostPengumuman($data)
    {
        $this->db->insert('pengumuman', $data);
    }

    function PostTipsBencana($data)
    {
        $this->db->insert('tips_bencana', $data);
    }

    function PostInfoPelatihan($data)
    {
        $this->db->insert('info_pelatihan', $data);
    }

    function postGaleri($data)
    {
        $this->db->insert('galeri', $data);
    }

    function PostStatistik($data)
    {
        $this->db->insert('statistik', $data);
    }

    #Put Data
    function Tambah_view_aturan($id, $data)
    {
        $this->db->where('id_peraturan', $id);
        $this->db->update('peraturan', $data);
    }
    function Tambah_view_materi($id, $data)
    {
        $this->db->where('id_materi', $id);
        $this->db->update('materi', $data);
    }
    function Tambah_view_video($id, $data)
    {
        $this->db->where('id_video', $id);
        $this->db->update('video', $data);
    }

    function PutBerita($id, $data)
    {
        $this->db->where('id', $id);
        $this->db->update('berita', $data);
    }

    function PutPengumuman($id, $data)
    {
        $this->db->where('id', $id);
        $this->db->update('pengumuman', $data);
    }

    function PutTipsBencana($id, $data)
    {
        $this->db->where('id', $id);
        $this->db->update('tips_bencana', $data);
    }

    function PutInfoPelatihan($id, $data)
    {
        $this->db->where('id', $id);
        $this->db->update('info_pelatihan', $data);
    }

    function UbahKodeUtamaBanner($id, $data)
    {
        $this->db->where('id_banner', $id);
        $this->db->update('banner', $data);
    }


    #Hapus Data
    function DelUser($id)
    {
        $this->db->where('id_admin', $id);
        $this->db->delete('admin');
    }

    function DelAturan($id)
    {
        $this->db->where('id_peraturan', $id);
        $this->db->delete('peraturan');
    }
    function DelMateri($id)
    {
        $this->db->where('id_materi', $id);
        $this->db->delete('materi');
    }
    function DelVideo($id)
    {
        $this->db->where('id_video', $id);
        $this->db->delete('video');
    }

    function DelBerita($id)
    {
        $this->db->where('id', $id);
        $this->db->delete('berita');
    }

    function DelPengumuman($id)
    {
        $this->db->where('id', $id);
        $this->db->delete('pengumuman');
    }

    function DelTipsBencana($id)
    {
        $this->db->where('id', $id);
        $this->db->delete('tips_bencana');
    }

    function DelInfoPelatihan($id)
    {
        $this->db->where('id', $id);
        $this->db->delete('info_pelatihan');
    }
}
